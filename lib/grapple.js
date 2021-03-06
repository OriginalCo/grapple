// Generated by CoffeeScript 1.4.0
(function() {
  var Schema, each, mongoose, _;

  _ = require("underscore");

  each = require("each");

  mongoose = null;

  Schema = function(obj) {
    this.schema = new mongoose.Schema(obj);
    this.preferences = {};
    this.references = [];
  };

  Schema.prototype.configure = function(obj) {
    if (typeof obj === "function") {
      obj(this.schema);
    } else {
      this.schema.add(obj);
    }
    return this;
  };

  Schema.prototype.plugin = function(plugin) {
    this.schema.plugin(plugin);
    return this;
  };

  Schema.prototype.method = function(name, func) {
    this.schema.method(name, func);
    return this;
  };

  Schema.prototype.setPreference = function(key, val) {
    if (typeof key === "object") {
      _.extend(this.preferences, key);
    } else {
      this.preferences[key] = val;
    }
    return this;
  };

  Schema.prototype.getPreference = function(key) {
    return this.preferences[key];
  };

  Schema.prototype.sanitizeReferencesManually = function() {
    return this.setPreference("manualReferenceSanitization", true);
  };

  Schema.prototype.compile = function(name) {
    var self;
    self = this;
    this.method("in", function(object, callback) {
      var model, object_id;
      model = this;
      object_id = object._id;
      delete object._id;
      return each(self.references).on("item", function(ref, i, next) {
        var SubSchema, subModel;
        if (ref.relation === "many") {
          if (object[ref.field].length > 0) {
            _.each(object[ref.field], function(val, i) {
              var SubSchema, subModel;
              if (val != null) {
                if (val.toString() === "[object Object]") {
                  if (!(val._id != null)) {
                    SubSchema = mongoose.model(ref.schema);
                    subModel = new SubSchema(val);
                    object[ref.field][i] = subModel;
                    return subModel.save(function(err) {
                      if (err) {
                        return console.log("Error dynamically saving reference \"" + ref.field("\":", err));
                      }
                    });
                  } else {
                    return object[ref.field][i] = val._id;
                  }
                } else {
                  return object[ref.field][i] = val;
                }
              } else {
                return console.log("Error processing \"" + ref.field + "\" collection: a null value exists in the array.");
              }
            });
          }
        } else if (ref.relation === "one") {
          if (object[ref.field] != null) {
            if (object[ref.field].toString() === "[object Object]") {
              if (!(object[ref.field]._id != null)) {
                SubSchema = mongoose.model(ref.schema);
                subModel = new SubSchema(object[ref.field]);
                object[ref.field] = subModel;
                subModel.save(function(err) {
                  if (err) {
                    return console.log("Error dynamically saving reference \"" + ref.field("\":", err));
                  }
                });
              }
            } else {
              object[ref.field] = {
                _id: object[ref.field]
              };
            }
          }
        }
        return next();
      }).on("error", function(err) {
        return console.log("Error processing references:", err);
      }).on("end", function() {
        _.extend(model, object);
        return model.save(function(err) {
          if (err) {
            console.log("There was an error saving model on \"in\":", err);
          }
          return callback(model);
        });
      });
    });
    this.method("out", function(callback) {
      var model, process;
      model = this;
      process = function(response) {
        if (self.getPreference("manualReferenceSanitization" || self.references.length === 0)) {
          callback(response);
          return;
        }
        return each(self.references).on("item", function(ref, i, next) {
          response[ref.field] = model[ref.field];
          if (response[ref.field]) {
            if (ref.relation === "many") {
              return each(response[ref.field]).on("item", function(item, i, next) {
                return mongoose.model(typeof ref.schema === "string" ? ref.schema : ref.relationName).findOne({
                  _id: item._id || item
                }).exec(function(err, obj) {
                  if (obj) {
                    if (obj.lightweight) {
                      return obj.lightweight(function(obj) {
                        response[ref.field][i] = obj;
                        return next();
                      });
                    } else {
                      response[ref.field][i] = obj.toObject();
                      return next();
                    }
                  } else {
                    console.log("Error retrieving lightweight object because the object does not exist, field '" + ref.field + "', id '" + item + "'");
                    return next();
                  }
                });
              }).on("error", function(err, errors) {
                return console.log("Error processing array-type reference in schema.js", err);
              }).on("end", function() {
                return next();
              });
            } else {
              return mongoose.model(typeof ref.schema === "string" ? ref.schema : ref.relationName).findOne({
                _id: response[ref.field]._id || response[ref.field]
              }).exec(function(err, obj) {
                if (obj) {
                  if (obj.lightweight) {
                    return obj.lightweight(function(obj) {
                      response[ref.field] = obj;
                      return next();
                    });
                  } else {
                    response[ref.field] = obj.toObject();
                    return next();
                  }
                } else {
                  console.log("Error retrieving lightweight object because the object does not exist, field '" + ref.field + "', id '" + (response[ref.field]._id || response[ref.field]) + "'");
                  return next();
                }
              });
            }
          } else {
            return next();
          }
        }).on("error", function(err, errors) {
          return console.log("Error processing references in schema.js", err);
        }).on("end", function() {
          return callback(response);
        });
      };
      if (this.sanitize) {
        return this.sanitize(process);
      } else {
        return process(this.toObject());
      }
    });
    _.each(this.references, function(e, i) {
      var get, schemaObject, set;
      e.relationName = e.relationName.split("{{parent}}").join(name);
      schemaObject = {};
      get = function(key) {
        return key;
      };
      set = function(key, val) {
        return key._id;
      };
      switch (e.relation) {
        case "one":
          schemaObject[e.field] = {
            type: mongoose.Schema.ObjectId,
            ref: (typeof e.schema === "string" ? e.schema : e.relationName),
            get: get,
            set: set
          };
          if (e.options) {
            _.extend(schemaObject[e.field], e.options);
          }
          break;
        case "many":
          schemaObject[e.field] = [
            {
              type: mongoose.Schema.ObjectId,
              ref: (typeof e.schema === "string" ? e.schema : e.relationName),
              get: get,
              set: set
            }
          ];
          if (e.options) {
            _.extend(schemaObject[e.field][0], e.options);
          }
          break;
      }
      if (typeof e.schema !== "string") {
        e.schema.compile(e.relationName);
      }
      return self.schema.add(schemaObject);
    });
    mongoose.model(name, this.schema);
    return this;
  };

  Schema.prototype.requires = function(name) {
    return this.has(name, {
      required: true
    });
  };

  Schema.prototype.has = function(name, options) {
    var reference, self;
    self = this;
    reference = {
      field: name,
      options: options,
      one: function(schema) {
        this.relation = "one";
        this.relationName = (function(str) {
          return str.charAt(0).toUpperCase() + str.slice(1);
        })(this.field);
        this.schema = schema;
        return self;
      },
      many: function(schema) {
        this.relation = "many";
        this.relationName = (function(str) {
          return "{{parent}}" + str;
        })((function(str) {
          return str.slice(0, -1);
        })((function(str) {
          return str.charAt(0).toUpperCase() + str.slice(1);
        })(this.field)));
        this.schema = schema;
        return self;
      }
    };
    this.references.push(reference);
    return reference;
  };

  exports["new"] = function(_mongoose, obj) {
    mongoose = _mongoose;
    return new Schema(obj);
  };

}).call(this);
