var express = require('express'); 
var app = express.createServer();
var sys = require("sys"),
http = require("http"),
url = require("url"),
path = require("path"),
fs = require("fs"),
events = require("events"),
redis = require("redis-client"),
im = require('imagemagick');


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
  app.use(app.router);
  app.use(express.staticProvider(__dirname + '/images'));
});


app.get('/', function(req, res){
  res.render('index.jade', {
    locals: { title: 'My Site',
    youAreUsingJade: 'true'
  }
});
});

app.get('/tag/:tag', function(req, res){
  var tag = req.params.tag;
  var r = redis.createClient();
  r.stream.on( 'connect', function() {
    r.lrange( 'tag:'+tag, -5, -1, function( err, data ) {
      if( !data ) {
        res.writeHead( 404 );
        res.write( "No such tag" );
        res.end();
        return;
      }

      res.writeHead( 200, { "Content-Type" : "text/html" } );
      for (var i = 0; i < data.length; i++) {
        var obj = JSON.parse( data[i].toString() );
        res.write("<img src='/"+obj.filename+"'>");
      };
      res.end();
      r.close();
    });
  });
});

app.get('/image/:id', function(req, res){
  var id = req.params.id;
  var r = redis.createClient();
  r.stream.on( 'connect', function() {
    r.get( 'snippet:'+id, function( err, data ) {
      if( !data ) {
        res.writeHead( 404 );
        res.write( "No such image" );
        res.end();
        return;
      }

      res.writeHead( 200, { "Content-Type" : "text/html" } );

      var obj = JSON.parse( data.toString() );

      res.write("<img src='/thumb-"+obj.filename+"'>");
      res.end();
      r.close();
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
    sys.puts(tags[i]);
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
  sys.puts("Downloading file: " + filename);
  sys.puts("Before download request");
  var request = theurl.request('GET', requestUrl, {"host": host});
  request.end();

  var dlprogress = 0;

  request.addListener('response', function (response) {
    var downloadfile = fs.createWriteStream("images/"+filename, {'flags': 'a'});
    sys.puts("File size " + filename + ": " + response.headers['content-length'] + " bytes.");
    response.addListener('data', function (chunk) {
      dlprogress += chunk.length;
      downloadfile.write(chunk, encoding='binary');
    });
    response.addListener("end", function() {
      downloadfile.end();
      im.resize({
        srcPath: 'images/'+filename,
        dstPath: 'images/thumb-'+filename,
        width:   500
      }, function(err, stdout, stderr){
        if (err) throw err
        var r = redis.createClient();
        r.stream.on( 'connect', function() {
          var jobj = JSON.stringify(obj);
          r.incr( 'nextid' , function( err, id ) {
            r.set( 'snippet:'+id, jobj, function() {
              var msg = 'The snippet has been saved at <a href="/image/'+id+'">'+req.headers.host+'/image/'+id+'</a>';
              res.send( msg );
            } );
            for (var i = 0; i < tags.length; i++) {
              r.rpush( 'tag:'+tags[i] , jobj );
            };
          sys.puts("Finished crop " + filename);
          } );
        } );
      });
      sys.puts("Finished downloading " + filename);
    });
  });
});


if (!module.parent) {
  app.listen(3000);
  //var r = redis.createClient();
  //r.flushdb();
  console.log("Express server listening on port %d", app.address().port);
}
