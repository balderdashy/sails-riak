// Generated by CoffeeScript 1.4.0
(function() {
  var RiakDB, TaskPool, deferred, promisify, riakJS, _;

  riakJS = require('riak-js');

  _ = require('underscore');

  _.str = require('underscore.string');

  _.mixin(_.str.exports());

  deferred = require('deferred');

  promisify = deferred.promisify;

  TaskPool = require('./task-pool');

  module.exports = RiakDB = (function() {

    function RiakDB(collection) {
      var createModelTaskPools, db, dbGetAll, dbGetPromise, dbRemovePromise, dbSaveBucketPromise, dbSavePromise, dbSearchPromise;
      this.tag = collection.dbTag;
      db = riakJS.getClient({
        port: collection.port,
        host: collection.host
      });
      dbRemovePromise = _.bind(promisify(db.remove), db);
      dbSavePromise = _.bind(promisify(db.save), db);
      dbSaveBucketPromise = _.bind(promisify(db.saveBucket), db);
      dbGetPromise = _.bind(promisify(db.get), db);
      dbGetAll = _.bind(promisify(db.getAll), db);
      dbSearchPromise = _.bind(promisify(db.search.find), db.search);
      createModelTaskPools = {};
      this.create = promisify(function(collectionName, model, cb) {
        var createModelPromise,
          _this = this;
        if (!((collectionName != null) && (model != null))) {
          return cb(new Error("RiakDB#create - Collection name and model definition must be provided."));
        }
        createModelPromise = promisify(function(cb) {
          var _this = this;
          return this.describeSchema(collectionName).then(function(schema) {
            var attrName, attrNames, modelKey, _i, _len;
            if (schema == null) {
              throw new Error("Cannot get schema for collection: " + collectionName + " for DB instance: " + _this.tag);
            }
            attrNames = _.keys(_.extend({}, schema.attributes, model));
            for (_i = 0, _len = attrNames.length; _i < _len; _i++) {
              attrName = attrNames[_i];
              if (_.isObject(schema.attributes[attrName]) && schema.attributes[attrName].autoIncrement) {
                if (!(model[attrName] != null)) {
                  model[attrName] = schema.autoIncrement;
                } else {
                  if (parseInt(model[attrName]) > schema.autoIncrement) {
                    schema.autoIncrement = parseInt(model[attrName]);
                  }
                }
                modelKey = model[attrName];
                break;
              }
            }
            schema.autoIncrement += 1;
            return _this.defineSchema(collectionName, schema, {}).then(function(schema) {
              return deferred(modelKey);
            });
          }).then(function(key) {
            return _this.save(collectionName, key, model);
          }).end(function(model) {
            return cb(null, model);
          }, function(err) {
            return cb(err);
          });
        });
        if (!(createModelTaskPools[collectionName] != null)) {
          createModelTaskPools[collectionName] = {};
          createModelTaskPools[collectionName].taskPool = new TaskPool;
          createModelTaskPools[collectionName].cbTable = {};
          createModelTaskPools[collectionName].taskPool.on('task:complete', function(completedTaskId, model) {
            createModelTaskPools[collectionName].cbTable[completedTaskId].call(null, null, model);
            return delete createModelTaskPools[collectionName].cbTable[completedTaskId];
          });
          createModelTaskPools[collectionName].taskPool.on('error', function(failedTaskId, err) {
            createModelTaskPools[collectionName].cbTable[failedTaskId].call(null, err);
            return delete createModelTaskPools[collectionName].cbTable[failedTaskId];
          });
          createModelTaskPools[collectionName].taskPool.on('drain:complete', function() {
            createModelTaskPools[collectionName].taskPool.removeAllListeners('task:complete');
            createModelTaskPools[collectionName].taskPool.removeAllListeners('drain:complete');
            createModelTaskPools[collectionName].taskPool.removeAllListeners('error');
            return createModelTaskPools[collectionName] = null;
          });
        }
        createModelTaskPools[collectionName].cbTable[createModelTaskPools[collectionName].taskPool.addTask(createModelPromise, [], this)] = cb;
        return createModelTaskPools[collectionName].taskPool.drain();
      });
      this.save = promisify(function(collectionName, key, model, cb) {
        if (!((collectionName != null) && (key != null) && (model != null))) {
          return cb(new Error("RiakDB#save - Collection name, key and model definition must be provided."));
        }
        return dbSavePromise("" + this.tag + "_" + collectionName, key, model, {
          returnbody: true
        }).end(function(result) {
          return cb(null, result.shift());
        }, function(err) {
          return cb(err);
        });
      });
      this.get = promisify(function(collectionName, key, cb) {
        var _this = this;
        if (!((collectionName != null) && (key != null))) {
          return cb(new Error("RiakDB#get - The collection name and the key must be provided."));
        }
        return dbGetPromise("" + this.tag + "_" + collectionName, key, {}).end(function(result) {
          return cb(null, result.shift());
        }, function(err) {
          if (err.statusCode === 404) {
            return cb(null);
          } else {
            return cb(err);
          }
        });
      });
      this.remove = promisify(function(collectionName, key, cb) {
        var _this = this;
        if (!((collectionName != null) && (key != null))) {
          return cb(new Error("RiakDB#delete - The collection name and the key must be provided."));
        }
        return dbRemovePromise("" + this.tag + "_" + collectionName, key).end(function(result) {
          return cb(null, result[1].key);
        }, function(err) {
          return cb(err);
        });
      });
      this.deleteAll = promisify(function(collectionName, cb) {
        var _this = this;
        if (collectionName == null) {
          return cb(new Error("RiakDB#deleteAll - The collection name must be provided."));
        }
        return this.getAllKeys(collectionName).then(function(keys) {
          return deferred.map(keys, function(key) {
            return _this.remove(collectionName, key).then(function(deletedKey) {
              return deletedKey;
            });
          });
        }).end(function(deletedKeys) {
          return cb(null, deletedKeys);
        }, function(err) {
          return cb(err);
        });
      });
      this.getAllKeys = promisify(function(collectionName, cb) {
        var keyList, keyStream;
        if (collectionName == null) {
          return cb(new Error("RiakDB#getAllKeys - Collection name must be provided."));
        }
        keyStream = db.keys("" + this.tag + "_" + collectionName, {
          keys: 'stream'
        }, void 0);
        keyList = [];
        keyStream.on('keys', function(keys) {
          var key, _i, _len, _results;
          _results = [];
          for (_i = 0, _len = keys.length; _i < _len; _i++) {
            key = keys[_i];
            _results.push(keyList.push(key));
          }
          return _results;
        });
        keyStream.on('end', function() {
          return cb(null, keyList);
        });
        return keyStream.start();
      });
      this.getAllModels = promisify(function(collectionName, cb) {
        var _this = this;
        if (collectionName == null) {
          return cb(new Error("RiakDB#getAllModels - Collection name must be provided."));
        }
        return dbGetAll("" + this.tag + "_" + collectionName).end(function(result) {
          return cb(null, result.shift());
        }, function(err) {
          return cb(err);
        });
      });
      this.getMaxIndex = promisify(function(collectionName, cb) {
        if (collectionName == null) {
          return cb(new Error("RiakDB#getAllModlesInCollection - Collection name must be provided."));
        }
        return db.mapreduce.add("" + this.tag + "_" + collectionName).map(function(riakObj) {
          return [(Riak.mapValuesJson(riakObj)[0]).id];
        }).reduce(function(v) {
          return [Math.max.apply(null, v)];
        }).run(function(err, maxIndex) {
          if (err != null) {
            return cb(err);
          } else {
            return cb(null, maxIndex[0]);
          }
        });
      });
      this.defineSchema = promisify(function(collectionName, definition, options, cb) {
        var savedModel,
          _this = this;
        if (!((collectionName != null) && (definition != null))) {
          return cb(new Error('RiakDB#defineSchema - Collection name and schema definition must be provided.'));
        }
        savedModel = null;
        return dbSavePromise("" + this.tag + "_schema", collectionName, definition, {
          returnbody: true
        }).then(function(result) {
          savedModel = result.shift();
          if ((options != null ? options.search : void 0) === true) {
            return dbSaveBucketPromise("" + _this.tag + "_" + collectionName, {
              search: true
            });
          } else {
            return deferred(true);
          }
        }).end(function() {
          return cb(null, savedModel);
        }, function(err) {
          return cb(err);
        });
      });
      this.describeSchema = promisify(function(collectionName, cb) {
        if (collectionName == null) {
          return cb(new Error("RiakDB#describeSchema - Collection name must be provided."));
        }
        return dbGetPromise("" + this.tag + "_schema", collectionName, {}).end(function(result) {
          return cb(null, result.shift());
        }, function(err) {
          if (err.statusCode === 404) {
            return cb(null);
          } else {
            return cb(err);
          }
        });
      });
      this.search = promisify(function(collectionName, searchTerm, cb) {
        if (!((collectionName != null) && (searchTerm != null))) {
          return cb(new Error("RiakDB#searchInCollection - Collection name must and the search-term be provided."));
        }
        return dbSearchPromise("" + this.tag + "_" + collectionName, "" + searchTerm).end(function(result) {
          return cb(null, result.shift()['docs']);
        }, function(err) {
          return cb(err);
        });
      });
      this.deleteSchema = promisify(function(collectionName, cb) {
        if (collectionName == null) {
          return new Error("RiakDB#deleteSchema - Collection name must be provided.");
        }
        return dbRemovePromise("" + this.tag + "_schema", collectionName).end(function(result) {
          return cb(null, result[1].key);
        }, function(err) {
          if (err.statusCode === 404) {
            return cb(null);
          } else {
            return cb(err);
          }
        });
      });
    }

    return RiakDB;

  })();

}).call(this);
