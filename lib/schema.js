// Schema, which wraps Mongoose's Schema for pretty and extendable models.

var _ = require('underscore')
  , each = require('each')
  , mongoose = require('mongoose')
  , Schema = function(obj) {
    this.schema = new mongoose.Schema(obj) 
    this.references = []
  }

// ### configure(obj)
// Accepts either a lambda that accepts a schema, or an object that contains
// Mongoose schema configuration. This can be used to extend the schema or to
// configure the schema directly.
Schema.prototype.configure = function(obj) {
  if(typeof obj === 'function') {
    obj(this.schema)
  } else {
    this.schema.add(obj)
  }
  return this
}

// ### plugin(path_to_plugin)
// Accepts a path to a Mongoose schema plugin and attaches the plugin to the
// schema.
Schema.prototype.plugin = function(plugin) {
  this.schema.plugin(require(plugin))
  return this
}

// ### method(name, func)
// Appends a method ([func]) named [name] to the schema. This simply wraps the
// native mongoose.Schema.method method.
Schema.prototype.method = function(name, func) {
  this.schema.method(name, func)
  return this
}

// ### compile(name)
// This should be called last in the method chain, and assembles the Mongoose
// Schema and registers it as [name] as well as any sub-schemas as defined by
// the relational methods.
Schema.prototype.compile = function(name) {
  var self = this

  // Accepts an object and attempts to merge with the model, saves it, then
  // passes the Mongoose model to the callback.
  this.method('in', function(object, callback) {
    var object_id = object._id
    delete object._id
    _.each(self.references, function(ref, i) {
      if(ref.relation == 'many') {
        _.each(object[ref.field], function(val, i) {
          if(val) {
            object[ref.field][i] = val._id || val
          }
          else {
            console.log('Error processing "' + ref.field + '" collection: a null value exists in the array.')
          }
        })
      }
    })
    _.extend(this, object)
    this.save()
    callback(this)
  })

  // Passes a sanitized object to the callback from the Mongoose model.
  this.method('out', function(callback) {

    var model = this
    // It would be really nice if you could populate a model that's already
    // instantiated. This is a big limitation in Mongoose that if resolved,
    // would save most of this headache.
      , process = function(response) {

        // If the model doesn't have any embedded documents, just respond with the
        // sanitized model.
        if(self.references.length == 0) {
          callback(response)
          return
        }

        // Iterate through each reference, and return the lightweight
        // representation of them.
        each(self.references)
          .on('item', function(ref, i, next) {

            // Assinging the field whatever corresponding value exists in the model
            // for now, which will transform later. It will either be an ObjectId or
            // an object that contains an _id.
            response[ref.field] = model[ref.field]

            // If the value exists in the model, which it should, process it.
            // Otherwise fail nicely by just returning whatever we have.
            if(response[ref.field]) {

              // We need to test if the field is an object or a collection. If it a
              // collection, process each item in the collection.
              if(ref.relation == 'many') { 

                each(response[ref.field])
                  .on('item', function(item, i, next) {

                    // Get the model either by the generated schema name or by the
                    // explicit schema name.
                    mongoose.model(typeof ref.schema === 'string' ? ref.schema : ref.relationName)

                      // The item in the collection will either be an ObjectId or
                      // an object with an _id; use that to find the referenced
                      // object.
                      .findOne({ _id: item._id || item })
                      .exec(function(err, obj) {

                        if(obj) {
                          // Replace the item in the collection with the lightweight
                          // representation if it's available.
                          if(obj.lightweight) {
                            obj.lightweight(function(obj) {
                              response[ref.field][i] = obj
                              next()
                            })
                          } else {
                            response[ref.field][i] = obj.toObject()
                            next()
                          }
                        } else {
                          console.log('Error retrieving lightweight object because the object does not exist:', item)
                          next()
                        }
                      })
                  })
                  .on('error', function(err, errors) {
                    console.log('Error processing array-type reference in schema.js', err)
                  })
                  .on('end', function() {
                    next()
                  })
              } else {

                // Get the model either by the generated schema name or by the
                // explicit schema name.
                mongoose.model(typeof ref.schema === 'string' ? ref.schema : ref.relationName)

                  // The item will either be an ObjectId or an object with an _id;
                  // use that to find the referenced object.
                  .findOne({ _id: response[ref.field]._id || response[ref.field] })
                  .exec(function(err, obj) {

                    // Replace the item with the lightweight representation if
                    // it's available.
                    if(obj.lightweight) {
                      obj.lightweight(function(obj) {
                        response[ref.field] = obj
                        next()
                      })
                    } else {
                      response[ref.field] = obj.toObject()
                      next()
                    }
                  })
              }
            } else {
              next()
            }
          })
          .on('error', function(err, errors) {
            console.log('Error processing references in schema.js', err)
          })
          .on('end', function() {
            callback(response)
          })
      }

    // Run the sanitization function on the response if the model implements
    // it.
    if(this.sanitize) {
      this.sanitize(process)
    } else {
      process(this.toObject())
    }

  })
  
  // Iterate through the references to and assemble the schemaObject.
  _.each(this.references, function(e, i) {

    // Generate a relation name based on the name of the parent (containing)
    // object. This is useful if we need to register a dynamic schema.
    e.relationName = e.relationName.split('{{parent}}').join(name)

    var schemaObject = {}
      , get = function(key) {
        return key
      }
      , set = function(key, val) {
        return key._id
      }

    // Assemble the schema object for each relation.
    // It's either an object or a collection. This could be more elegant.
    switch(e.relation) {
      case 'one':
        schemaObject[e.field] = {type: mongoose.Schema.ObjectId, ref: typeof e.schema === 'string' ? e.schema : e.relationName, get: get, set: set}
        if(e.options) {
          _.extend(schemaObject[e.field], e.options)
        }
        break
      case 'many':
        schemaObject[e.field] = [{type: mongoose.Schema.ObjectId, ref: typeof e.schema === 'string' ? e.schema : e.relationName, get: get, set: set}]  
        if(e.options) {
          _.extend(schemaObject[e.field][0], e.options)
        }
        break
      default:
    }

    // If it's a complex schema, recursively compile that.
    if(typeof e.schema !== 'string') {
      e.schema.compile(e.relationName)
    }

    // Add the schema object to the schema.
    self.schema.add(schemaObject)
  })

  // Finally, register the schema with the model name.
  mongoose.model(name, this.schema)
  return this
}

// ## Relational methods
// These are used to define and extend the schema's relationships to sub-
// schemas. The first return value is a "has" object that contains the
// following methods:

// one(schema): Accepts either a name (string) or a schema (schema)

// many(schema): Accepts either a name (string) or a schema (schema)

// ### requires(name) 
// Returns a "has" object as a required schema property.

Schema.prototype.requires = function(name) {
  return this.has(name, { required: true })
}

// ### has(name, [options])
// Returns a "has" object with no options by default.
Schema.prototype.has = function(name, options) {
  var self = this

  ,reference = {
    field: name
    ,options: options

    // #### one(schema) 
    ,one: function(schema) {
      this.relation = 'one'
      this.relationName = (function(str) {
        return str.charAt(0).toUpperCase() + str.slice(1)
      })(this.field)
      this.schema = schema
      return self
    }

    // #### many(schema)
    ,many: function(schema) {
      this.relation = 'many'
      this.relationName = (function(str) {
          return '{{parent}}' + str
        })((function(str) {
          return str.slice(0, -1)
        })((function(str) {
          return str.charAt(0).toUpperCase() + str.slice(1)
        })(this.field)))
      this.schema = schema
      return self
    }

  }
  this.references.push(reference)
  return reference
}

exports.new = function(obj) {
  return new Schema(obj)
}
