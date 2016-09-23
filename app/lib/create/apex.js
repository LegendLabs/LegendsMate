'use strict';

var _         = require('lodash');
var logger    = require('winston');
var Document  = require('../document').Document;

function ApexCreator(project, documents, force) {
  this.project = project;
  this.documents = documents;
  this.force = force;
}

ApexCreator.prototype.create = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    try {
      // logger.debug('Creating ApexDocuments', self.documents);
      var createPromises = [];
      _.each(self.documents, function(d) {
        createPromises.push(self.project.sfdcClient.createApexMetadata(d));
      });
      Promise.all(createPromises)
        .then(function(results) {
          return Promise.all([
            self._updateStores(results),
            self.project.packageXml.add(self.documents)
          ]);
        })
        .then(function() {
          self.project.packageXml.save();
          resolve();
        })
        .catch(function(err) {
          // todo: delete local members
          reject(err);
        });
    } catch(e) {
      reject(e);
    }
  });
};

ApexCreator.prototype._updateStores = function(results) {
  var self = this;
  return new Promise(function(resolve, reject) {
    try {
      _.each(results, function(r, i) {
        var doc = self.documents[i];
        doc.updateLocalStoryEntry({ id: r.id });
      });
      self.project.sfdcClient.getApexServerProperties(self.documents)
        .then(function(serverProperties) {
          return Promise.all([
            self.project.localStore.update(serverProperties),
            self.project.serverStore.refreshTypes(self.project.sfdcClient, Document.getTypes(self.documents))
          ]);
        })
        .then(function() {
          resolve(_.flatten(results));
        })
        .catch(function(err) {
          reject(err);
        });
    } catch(e) {
      reject(e);
    }
  });
};

ApexCreator.createAll = function(project, documents, force) {
  return new Promise(function(resolve, reject) {
    var apexCreator = new ApexCreator(project, documents, force);
    apexCreator.create()
      .then(function(res) {
        resolve(res);
      })
      .catch(function(err) {
        reject(err);
      });
  });
};

module.exports = ApexCreator;