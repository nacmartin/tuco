var express = require('express'); 
var app = express.createServer();
var sys = require("sys"),
http = require("http"),
url = require("url"),
path = require("path"),
fs = require("fs"),
events = require("events"),
redis = require("redis"),
client = redis.createClient(),
im = require('imagemagick');

client.on("error", function (err) {
    console.log("Error " + err);
});

//Images per page
var IMGXPAG = 10;

var allTags = [];

function trim(string) {
  return string.replace(/^\s*|\s*$/, '');
}

app.configure('development', function() {
  app.use(express.logger());
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function() {
  app.use(express.logger());
  app.use(express.errorHandler()); 
});


app.configure(function(){
  app.use(express.methodOverride());
  app.use(express.bodyParser());
  app.use(express.compiler({ src: __dirname + '/public', enable: ['less']}));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

//refreshes the array allTags with all tags in db
function refreshAllTags(){
  var tagArr = [];
  client.lrange( 'tags', 0, -1, function( err, data ) {
    for (var i = 0; i < data.length; i++) {
      tagArr.push(data[i].toString());
    };
    allTags = tagArr;
  });
}

//show lists of images filtered by tag. If tag === null, then shows all images
function showList(page, tag, res){
  collection = tag ? 'tag:'+tag : 'images';
  var imagArr = [];
  page = parseInt( page , 10)
  client.llen(collection, function(err, nres){
    if(page * IMGXPAG > nres || nres === 0){
      res.writeHead( 404 );
      res.write( "No images!" );
      res.end();
      return;
    }else {
      //pagination stuff
      var maxpag = Math.ceil(nres / IMGXPAG) -1;
      pagination = {
        first   : (page === 0 ? null : 0),
        prev    : (page === 0 ? null : page -1),
        base    : (collection  === 'images' ? '/' : '/'+tag+'/'),
        current : page,
        next    : ((page + 1) > maxpag ? null : page + 1 ),
        last    : ((page + 1) > maxpag ? null : maxpag )
      }

      client.lrange( collection, -IMGXPAG - page * IMGXPAG, -1 - page * IMGXPAG, function( err, data ) {
        var count = data.length;
        for (var i = 0; i < data.length; i++) {
          var id = data[i].toString();
          client.get( 'image:'+id, function( err, dataIm ) {
            var obj = JSON.parse( dataIm.toString() );
            imagArr.push( obj);
            count--;
            if (count == 0){
              res.render('index.jade', {
                locals: {
                  images: imagArr.reverse(),
                  tags: allTags,
                  pagination: pagination
                }
              });
            }
          });
        }
      });
    }
  });
}

//Show images from all tags
app.get(/^\/(:?(\d+)?)$/, function(req, res){
  var page = req.params[0] || 0; 
  showList(page, null, res);
});

//Show images from one tag
app.get('/tag/:tag', function(req, res){
  var tag = req.params.tag;
  var page = req.params[0] || 0; 
  showList(page, tag, res);
});

//Show one image
app.get('/image/:id', function(req, res){
  var id = req.params.id;
  client.get( 'image:'+id, function( err, data ) {
    if( !data ) {
      res.writeHead( 404 );
      res.write( "No such image" );
      res.end();
      return;
    }

    var obj = JSON.parse( data.toString() );
    res.render('single.jade', {
      locals: {
        image: obj,
        tags: allTags
      }
    });

  });
});

//Remove one image
app.get('/remove/:id', function(req, res){
  var id = req.params.id;
  client.get( 'image:'+id, function( err, data ) {
    if( !data ) {
      res.writeHead( 404 );
      res.write( "No such image" );
      res.end();
      return;
    }
    var obj = JSON.parse( data.toString() );
    var tags = obj.tags;
    //remove from tag
    for (var i = 0; i < tags.length; i++) {
      client.lrem('tag:'+tags[i],1,id);
      var tag = tags[i];
      //remove tag if needed
      client.lrange( 'tag:'+tags[i], 0, -1, function( err, data ) {
        if (!data || data.length === 0){
          client.lrem('tags',1,tag);
          refreshAllTags();
        }
      });
      client.del('image:'+id);
      client.lrem('images',1,id);
    }
    res.redirect('/', 301);
  });
});

//save image
app.get(/^\/save\/([^\/]+)\/([^\/]*)\/([^\/]*)$/, function(req, res){
  urlfile = unescape(req.params[0]);
  var tags = req.params[1] ? req.params[1].split(",") : "";
  var title = req.params[2] || "";
  var i;
  for (i = 0; i < tags.length; i++) {
    tags[i] = trim(tags[i]);
  }

  var host = url.parse(urlfile).hostname;
  var filename = url.parse(urlfile).pathname.split("/").pop();
  var obj = {
    "filename" : filename,
    "tags" : tags,
    "title" : title
  }

  //retrieve it
  var theurl = http.createClient(80, host);
  var requestUrl = urlfile;
  console.log("Downloading file: " + filename);
  var request = theurl.request('GET', requestUrl, {"host": host});
  request.end();

  var dlprogress = 0;

  request.addListener('response', function (response) {
    var downloadfile = fs.createWriteStream("public/images/"+filename, {'flags': 'a'});
    console.log("File size " + filename + ": " + response.headers['content-length'] + " bytes.");
    response.addListener('data', function (chunk) {
      dlprogress += chunk.length;
      downloadfile.write(chunk, encoding='binary');
    });
    //download finished
    response.addListener("end", function() {
      downloadfile.end();
      im.resize({
        srcPath: 'public/images/'+filename,
        dstPath: 'public/images/thumb-'+filename,
        width:   500
      }, function(err, stdout, stderr){
        if (err) throw err
        var r = redis.createClient();
        //saving image to db
        client.incr( 'nextid' , function( err, id ) {
          obj.id = id;
          var jobj = JSON.stringify(obj);
          client.set( 'image:'+id, jobj, function() {
            var msg = 'The image has been saved at <a href="/image/'+id+'">'+req.headers.host+'/image/'+id+'</a>';
            res.send( msg );
          } );
          client.rpush( 'images' , id );
          //save tags if needed
          for (var i = 0; i < tags.length; i++) {
            (function(i) {
              setTimeout(function() {
                var etag = tags[i];
                client.exists('tag:'+etag, function(err, doesExist){
                  mytag = etag;
                  if(!doesExist){
                    client.rpush( 'tags',mytag);
                    refreshAllTags();
                  }
                });
                //push image id to this tag
                client.rpush( 'tag:'+etag , id );
              }, 0);
            })(i);
          };
          client.bgsave();
          console.log("Finished thumbnail " + filename);
        });
      });
      console.log("Finished downloading " + filename);
    });
  });
});

refreshAllTags();

if (!module.parent) {
  app.listen(3000);
  //client.flushdb();
  console.log("Express server listening on port %d", app.address().port);
}
