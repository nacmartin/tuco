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
  app.use(express.bodyDecoder());
  app.use(express.compiler({ src: __dirname + '/public', enable: ['less']}));
  app.use(app.router);
  app.use(express.staticProvider(__dirname + '/public'));
});


function refreshAllTags(){
  var tagArr = [];
  client.lrange( 'tags', 0, -1, function( err, data ) {
    for (var i = 0; i < data.length; i++) {
      tagArr.push(data[i].toString());
    };
    allTags = tagArr;
  });
}

app.get('/', function(req, res){
  var imagArr = [];
  client.lrange( 'images', -5, -1, function( err, data ) {
    if( !data ) {
      res.writeHead( 404 );
      res.write( "No images!" );
      res.end();
      return;
    }
    var count = data.length;
    for (var i = 0; i < data.length; i++) {
      var id = data[i].toString();
      client.get( 'snippet:'+id, function( err, dataIm ) {
        var obj = JSON.parse( dataIm.toString() );
        imagArr.push( obj);
        count--;
        if (count == 0){
          res.render('index.jade', {
            locals: {
              images: imagArr,
              tags: allTags
            }
          });
        }
      });
    }
  });
});

app.get('/tag/:tag', function(req, res){
  var tag = req.params.tag;
  var imagArr = [];
  client.lrange( 'tag:'+tag, -5, -1, function( err, data ) {
    if( !data ) {
      res.writeHead( 404 );
      res.write( "No such tag" );
      res.end();
      return;
    }
    var count = data.length;
    for (var i = 0; i < data.length; i++) {
      var id = data[i].toString();
      client.get( 'snippet:'+id, function( err, dataIm ) {
        var obj = JSON.parse( dataIm.toString() );
        imagArr.push( obj);
        count--;
        if (count == 0){
          res.render('index.jade', {
            locals: {
              images: imagArr,
              tags: allTags
            }
          });
        }
      });
    }
  });
});

app.get('/image/:id', function(req, res){
  var id = req.params.id;
  var r = redis.createClient();
  client.get( 'snippet:'+id, function( err, data ) {
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


app.get('/save/:link/:title/:tags', function(req, res){
  var urlfile = unescape(req.params.link);
  var tags = req.params.tags.split(",");
  var title = req.params.title;
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
    response.addListener("end", function() {
      downloadfile.end();
      im.resize({
        srcPath: 'public/images/'+filename,
        dstPath: 'public/images/thumb-'+filename,
        width:   500
      }, function(err, stdout, stderr){
        if (err) throw err
        var r = redis.createClient();
        client.incr( 'nextid' , function( err, id ) {
          obj.id = id;
          var jobj = JSON.stringify(obj);
          client.set( 'snippet:'+id, jobj, function() {
            var msg = 'The image has been saved at <a href="/image/'+id+'">'+req.headers.host+'/image/'+id+'</a>';
            res.send( msg );
          } );
          client.rpush( 'images' , id );
          for (var i = 0; i < tags.length; i++) {
            var etag = tags[i];
            client.exists('tag:'+etag, function(err, doesExist){
              if(!doesExist){
                client.rpush( 'tags',etag);
                refreshAllTags();
              }
            });
            client.rpush( 'tag:'+etag , id );
          };
          client.bgsave();
        console.log("Finished crop " + filename);
        } );
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
