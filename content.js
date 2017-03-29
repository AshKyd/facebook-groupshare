module.exports.document = function (documentId) {
  return new Promise (function (resolve, reject) {
    var request = require('request');
    return request.get(
      {
        url: 'https://content-gateway.abc-prod.net.au/api/v2/content/id/'+encodeURIComponent(documentId)
      },
      function(error, response, body) {
        var doc = null;
        if (!error && response.statusCode == 200) {
          var result = JSON.parse(body);
          if (result.docType == 'Article') {
            var doc = {};
            doc.id = result.id;
            doc.title = result.teaserTitle;
            doc.url = result.canonicalUrl;
            doc.image = null;
            if (typeof result.thumbnailLink !== 'undefined') {
              for (var j=0; j<result.thumbnailLink.media.length; j++) {
                var image = result.thumbnailLink.media[j].url;
                if (image.indexOf('16x9-thumbnail') !== -1) {
                  doc.image = image;
                }
              }
            }
          }
        }
        if (doc) {
          resolve(doc);
        }
        else {
          reject(Error('Content request error'));
        }
      }
    );
  });
};

module.exports.search = function (query) {
  return new Promise(function(resolve, reject) {
    var request = require('request');
    request.get(
      {
        url: 'https://api.cognitive.microsoft.com/bing/v5.0/news/search?q='+encodeURIComponent(query+' site:abc.net.au/news')+'&count=50&offset=0&mkt=en-us&safeSearch=Moderate',
        headers: {'Ocp-Apim-Subscription-Key': process.env.BING_API_KEY}
      },
      function(error, response, body) {
        if (!error && response.statusCode == 200) {
          var results = JSON.parse(body);
          var title = 'Search results';
          var message = null;
          var promises = [];
          for (var i=0; i<Math.min(8, results.value.length); i++) {
            var bingRedirectUrl = results.value[i].url;
            var bingRedirectUrlRegexMatches = /[\?\&]r=([^\&]*)/.exec(bingRedirectUrl);
            var abcNewsUrl = decodeURIComponent(bingRedirectUrlRegexMatches[1]);
            var abcNewsUrlRegexMatches = /(\d{5,})(\?|$)/.exec(abcNewsUrl);
            var documentId = abcNewsUrlRegexMatches[1];
            promises.push(module.exports.document(documentId));
          }
          Promise.all(promises).then(function(documents) {
            if (documents.length == 0) {
              message = 'No stories matched your search. Please try a different search.';
            }
            resolve({title: title, message: message, documents: documents});
          });
        }
        else {
          reject(Error('Search request error'));
        }
      }
    );
  });
};

module.exports.collection = function (collectionId) {
  return new Promise (function (resolve, reject) {
    var request = require('request');
    return request.get(
      {
        url: 'https://content-gateway.abc-prod.net.au/api/v2/content/id/'+encodeURIComponent(collectionId)
      },
      function(error, response, body) {
        if (!error && response.statusCode == 200) {
          var results = JSON.parse(body);
          var title = results.title;
          var message = null;
          var documents = [];
          for (var i=0; i<results.items.length && documents.length<12; i++) {
            if (results.items[i].docType == 'Article') {
              var doc = {};
              doc.id = results.items[i].id;
              doc.title = results.items[i].teaserTitle;
              doc.url = results.items[i].canonicalUrl;
              doc.image = null;
              if (typeof results.items[i].thumbnailLink !== 'undefined') {
                for (var j=0; j<results.items[i].thumbnailLink.media.length; j++) {
                  var image = results.items[i].thumbnailLink.media[j].url;
                  if (image.indexOf('16x9-thumbnail') !== -1) {
                    doc.image = image;
                  }
                }
              }
              documents.push(doc);
            }
          }
          if (documents.length == 0) {
            message = 'No stories.';
          }
          resolve({title: title, message: message, documents: documents});
        }
        else {
          reject(Error('Collection request error'));
        }
      }
    );
  });
};

module.exports.groupshare = function (collectionIds, search) {
  return new Promise (function (resolve, reject) {
    if (!collectionIds.isArray) {
      collectionIds = [collectionIds];
    }
    var promises = [];
    if (typeof search !== 'undefined' && search) {
      promises.push(module.exports.search(search));
    }
    for (var i=0; i<collectionIds.length; i++) {
      promises.push(module.exports.collection(collectionIds[i])); // Top Stories is 5513552
    }
    Promise.all(promises).then(function(collections) {
      resolve({
        title: 'Share with your group',
        search: search,
        collections: collections
      });
    });
  });
}