var fs = require('fs');
const http = require('http')  
const port = 7924
var request = require('request');
var profanities = require('profanities');
var env = require('node-env-file');
env(__dirname + '/.env');

if (!process.env.api_key) {
    console.log('Error: Specify a Google Vision API Key in environment.');
    process.exit(1);
}

const requestHandler = (req, res) => {
    var botResponse = {'accuracy': -1, 'words': []};
    if ((req.method == 'GET') && (req.url.startsWith('/?q='))) {
        var reqParam = './files/' + req.url.substring(4);
        console.log(reqParam);
       
        if (fs.existsSync(reqParam)) {
            let postBody = [];
            let postImgJson = {
                image: {content: fs.readFileSync(reqParam).toString('base64')},
                features: [{type: 'TEXT_DETECTION'}, {type: "DOCUMENT_TEXT_DETECTION"}, {type: "SAFE_SEARCH_DETECTION"}]
            };
            postBody.push(postImgJson);

            var options = {
                uri: 'https://vision.googleapis.com/v1/images:annotate?key=' + process.env.api_key,
                method: 'POST',
                json: {"requests": postBody}
            };
            request(options, function (error, apiResponse, apiResponseBody) {
              if (!error && apiResponse.statusCode == 200) {
                    var containsOwn = false;
                    var containsIt = false;
                    var unsafe = false;
                    if ((apiResponseBody.responses[0] != undefined) && (apiResponseBody.responses[0].textAnnotations != undefined)) {
                        for (i=0; i < apiResponseBody.responses[0].textAnnotations.length; i++) {
                            var currText = apiResponseBody.responses[0].textAnnotations[i];
                            botResponse.words.push(currText.description);
                            if (profanities.indexOf(currText.description.toLowerCase()) > -1) {
                                unsafe = true; 
                                console.log("BAD_WORD: " + currText.description)
                            }
                            if (currText.description.toLowerCase().indexOf('own') > -1) 
                                containsOwn = true;
                            if (currText.description.toLowerCase().indexOf('it') > -1)
                                containsIt = true;
                        }
                        
                        if (containsOwn && containsIt) botResponse.accuracy = 1;
                        else if (containsOwn || containsIt) botResponse.accuracy = 0;
                        
                        botResponse.safeSearch = apiResponseBody.responses[0].safeSearchAnnotation;
                        (botResponse.safeSearch["adult"].indexOf("UNLIKELY") > -1)?(botResponse.safeSearch["adult"] = false):(botResponse.safeSearch["adult"] = true);
                        (botResponse.safeSearch["spoof"].indexOf("UNLIKELY") > -1)?(botResponse.safeSearch["spoof"] = false):(botResponse.safeSearch["spoof"] = true);
                        (botResponse.safeSearch["medical"].indexOf("UNLIKELY") > -1)?(botResponse.safeSearch["medical"] = false):(botResponse.safeSearch["medical"] = true);
                        (botResponse.safeSearch["violence"].indexOf("UNLIKELY") > -1)?(botResponse.safeSearch["violence"] = false):(botResponse.safeSearch["violence"] = true);
                        if (unsafe) botResponse.safeSearch["adult"] = true;
                        //if ((botResponse.safeSearch["adult"] != true) || (botResponse.safeSearch["adult"] != false) botResponse.safeSearch["adult"] = false;
                    }
                    console.log('RESPONSE: ' + JSON.stringify(botResponse));
                    res.writeHead(200, {"Content-Type": "application/json"});
                    res.end(JSON.stringify(botResponse))
                } else {
                    res.end(JSON.stringify(error))
                    console.log("Error: " + error)
                }
            });
        } else {
            console.log("File not found.");
            res.end("File not found.")
        }
    }
}

const server = http.createServer(requestHandler)

server.listen(port, (err) => {  
  if (err) {
    return console.log('Error initializing web server: ', err)
  }

  console.log('Server is listening on ' + port)
})
