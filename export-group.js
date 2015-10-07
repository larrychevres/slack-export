var request = require("request");
var Promise = require("bluebird");
var fs = Promise.promisifyAll(require("fs"));

// credentials should be json with { secret: XXXXX, token: YYYYY } 

var credfile = 'credentials.json';
if (process.argv.length > 3) {
  credfile = process.argv[3];
}

var credentials = require('./' + credfile);
var fileOptions = { flag: 'w' }  //overwrite

var PAGE_SIZE = 100;

var list_url = "https://slack.com/api/groups.list?token=" + credentials.token + "&exclude_archived=1";
var channel_url = "https://slack.com/api/groups.history?token=" + credentials.token;
var channel_info_url = "https://slack.com/api/groups.info?token=" + credentials.token;

function isValidMsg(msg) {
  if (msg && msg.type == "message") {
    if (msg.text) {
      return true
    } else {
      // no text
      return false;
    }
  } else {
    return false;
  }
}

var getChannelInfo = Promise.promisify(function(channelId,cb) {
  channel_info_url = channel_info_url + "&channel=" + channelId;
  request({
      url: channel_info_url,
      json: true
    }, function(error, response, body) {
      if (!error) {
        fs.writeFileSync(tmp_dir + '/users.json','{}',fileOptions);
        fs.writeFile(tmp_dir + '/channels.json',JSON.stringify(body.group),fileOptions, cb);
      } else {
        cb("No channel found",null); 
      } 
    });
})

var getChannelId = Promise.promisify(function(name, cb) {
  request({
    url: list_url,
    json: true
  }, function(error, response, body) {
    var channel = body.groups.filter(function(x) { return x.name == name});
    if (channel && channel.length > 0) { 
      cb(null,channel[0].id);
    } else {
      cb("No channel found",null); 
    } 
  });
});

var getChannelMessages = Promise.promisify(function(channel_id,latest,cb) {
  channel_url += "&channel=" + channel_id + "&count=" + PAGE_SIZE
  if (latest) { 
    channel_url += "&latest=" + latest;
  }
  request({
    url: channel_url,
    json: true
  }, function(error, response, body) {
    if (!error) { 
      var results = []; 
      if (body && body.messages && body.messages.length > 0) {
        var results = body.messages.filter(function(x) { return isValidMsg(x); });
        cb(null, body); 
      } else {
        cb(null, { has_more: false });
      }
    } else {
      cb(error, null); 
    } 
  });
});

// used to do promisified while loop
var promiseWhile = function(condition, action) {
    var resolver = Promise.defer();

    var loop = function() {
        if (!condition()) return resolver.resolve();
        return Promise.cast(action())
            .then(loop)
            .catch(resolver.reject);
    };

    process.nextTick(loop);

    return resolver.promise;
};

// MAIN

// parse channel name and make temp dir
var channel_name = process.argv[2] || '';
var tmp_dir = '/tmp/slack-group-' + channel_name;
var msg_dir = tmp_dir + '/' + channel_name
if (channel_name) {
  var lstats = fs.lstatSync(tmp_dir);
  if (!lstats) {
    fs.mkdirSync(tmp_dir);  
  }
  if (!fs.existsSync(msg_dir)) {
    fs.mkdirSync(msg_dir);
  }
} else {
  console.log("Usage: node export-group.js [group name]");
  return;
}

getChannelId(channel_name)
.then(function(data){ 
  getChannelInfo(data);
  return data;
})
.then(function(data) {
  return data;
})
.then(function(channelId) { 
  var hasMore = true;
  var latest = null;
  var count = 0;

  promiseWhile(function() { return hasMore;  },
    function() {
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
            getChannelMessages(channelId, latest)
            .then(function(data) {
              hasMore = data.has_more;
              if (data.messages) {
                latest =data.messages[data.messages.length - 1].ts;
              }

              // now store off 
              if (data.messages) {
                fs.writeFileSync(msg_dir + '/' + count++ + '.json', JSON.stringify(data.messages,null,' '), fileOptions)
              }
              
              
            });
            resolve();
            // rate limit on slack is 1 call/second
        }, 1000);
    });
    });
})
.then(function(){
  console.log("Channel exported to: " + tmp_dir)
})