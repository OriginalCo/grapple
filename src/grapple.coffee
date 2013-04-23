_ = require("underscore")
each = require("each")
mongoose = null

Schema = (obj) ->
  @schema = new mongoose.Schema(obj)
  @preferences = {}
  @references = []
  return

# ### configure(obj)
# Accepts either a lambda that accepts a schema, or an object that contains
# Mongoose schema configuration. This can be used to extend the schema or to
# configure the schema directly.
Schema::configure = (obj) ->
  if typeof obj is "function"
    obj @schema
  else
    @schema.add obj
  this

# ### plugin(path_to_plugin)
# Accepts a path to a Mongoose schema plugin and attaches the plugin to the
# schema.
Schema::plugin = (plugin) ->
  @schema.plugin plugin
  this

# ### method(name, func)
# Appends a method ([func]) named [name] to the schema. This simply wraps the
# native mongoose.Schema.method method.
Schema::method = (name, func) ->
  @schema.method name, func
  this

# ### setPreference(key, val)
Schema::setPreference = (key, val) ->
  if typeof key is "object"
    _.extend @preferences, key
  else
    @preferences[key] = val
  this

# ### getPreference(key, val)
Schema::getPreference = (key) ->
  @preferences[key]

Schema::sanitizeReferencesManually = ->
  #@setPreference {"manualReferenceSanitization": true}
  @setPreference "manualReferenceSanitization", true

# ### compile(name)
# This should be called last in the method chain, and assembles the Mongoose
# Schema and registers it as [name] as well as any sub-schemas as defined by
# the relational methods.
Schema::compile = (name) ->
  self = this
  
  # Accepts an object and attempts to merge with the model, saves it, then
  # passes the Mongoose model to the callback.
  @method "in", (object, callback) ->
    model = this
    object_id = object._id
    delete object._id

    each(self.references).on("item", (ref, i, next) ->

      if ref.relation is "many"
        if object[ref.field].length > 0

          _.each object[ref.field], (val, i) ->
            if val?
              if val.toString() is "[object Object]"
                if not val._id?
                  SubSchema = mongoose.model(ref.schema)
                  subModel = new SubSchema(val)
                  object[ref.field][i] = subModel
                  subModel.save (err) ->
                    if err then console.log "Error dynamically saving reference \"" + ref.field "\":", err
                else
                  object[ref.field][i] = val._id
              else
                object[ref.field][i] = val
            else
              console.log "Error processing \"" + ref.field + "\" collection: a null value exists in the array."
              
      else if ref.relation is "one"
        if object[ref.field]?
          if object[ref.field].toString() is "[object Object]"
            if not object[ref.field]._id?
              SubSchema = mongoose.model(ref.schema)
              subModel = new SubSchema(object[ref.field])
              object[ref.field] = subModel
              subModel.save (err) ->
                if err then console.log "Error dynamically saving reference \"" + ref.field "\":", err
          else
            object[ref.field] = {_id: object[ref.field]}

      next()
    ).on("error", (err) ->
      console.log "Error processing references:", err

    ).on "end", ->
      _.extend model, object
      model.save (err) ->
        if err then console.log "There was an error saving model on \"in\":", err
        callback model

  # Passes a sanitized object to the callback from the Mongoose model.
  @method "out", (callback) ->
    model = this
    
    # It would be really nice if you could populate a model that's already
    # instantiated. This is a big limitation in Mongoose that if resolved,
    # would save most of this headache.
    process = (response) ->
      
      # If the model doesn't have any embedded documents, just respond with the
      # sanitized model.
      if self.getPreference "manualReferenceSanitization" or self.references.length is 0
        callback response
        return
      
      each(self.references).on("item", (ref, i, next) ->
        response[ref.field] = model[ref.field]
        if response[ref.field]
          if ref.relation is "many"
            each(response[ref.field]).on("item", (item, i, next) ->
              mongoose.model(if typeof ref.schema is "string" then ref.schema else ref.relationName).findOne(_id: item._id or item).exec (err, obj) ->
                if obj
                  if obj.lightweight
                    obj.lightweight (obj) ->
                      response[ref.field][i] = obj
                      next()

                  else
                    response[ref.field][i] = obj.toObject()
                    next()
                else
                  console.log "Error retrieving lightweight object because the object does not exist, field '" + ref.field + "', id '" + item + "'"
                  next()

            ).on("error", (err, errors) ->
              console.log "Error processing array-type reference in schema.js", err
            ).on "end", ->
              next()

          else
            mongoose.model(if typeof ref.schema is "string" then ref.schema else ref.relationName).findOne(_id: response[ref.field]._id or response[ref.field]).exec (err, obj) ->
              if obj
                if obj.lightweight
                  obj.lightweight (obj) ->
                    response[ref.field] = obj
                    next()

                else
                  response[ref.field] = obj.toObject()
                  next()
              else
                console.log "Error retrieving lightweight object because the object does not exist, field '" + ref.field + "', id '" + (response[ref.field]._id or response[ref.field]) + "'"
                next()
        else
          next()
      ).on("error", (err, errors) ->
        console.log "Error processing references in schema.js", err
      ).on "end", ->
        callback response
    
    # Run the sanitization function on the response if the model implements
    # it.
    if @sanitize
      @sanitize process
    else
      process @toObject()

  
  # Iterate through the references to and assemble the schemaObject.
  _.each @references, (e, i) ->
    
    # Generate a relation name based on the name of the parent (containing)
    # object. This is useful if we need to register a dynamic schema.
    e.relationName = e.relationName.split("{{parent}}").join(name)
    schemaObject = {}
    get = (key) ->
      key

    set = (key, val) ->
      key._id

    
    # Assemble the schema object for each relation.
    # It's either an object or a collection. This could be more elegant.
    switch e.relation
      when "one"
        schemaObject[e.field] =
          type: mongoose.Schema.ObjectId
          ref: (if typeof e.schema is "string" then e.schema else e.relationName)
          get: get
          set: set

        _.extend schemaObject[e.field], e.options  if e.options
      when "many"
        schemaObject[e.field] = [
          type: mongoose.Schema.ObjectId
          ref: (if typeof e.schema is "string" then e.schema else e.relationName)
          get: get
          set: set
        ]
        _.extend schemaObject[e.field][0], e.options  if e.options
      else
    
    # If it's a complex schema, recursively compile that.
    e.schema.compile e.relationName  if typeof e.schema isnt "string"
    
    # Add the schema object to the schema.
    self.schema.add schemaObject

  
  # Finally, register the schema with the model name.
  mongoose.model name, @schema
  this


# ## Relational methods
# These are used to define and extend the schema's relationships to sub-
# schemas. The first return value is a "has" object that contains the
# following methods:

# one(schema): Accepts either a name (string) or a schema (schema)

# many(schema): Accepts either a name (string) or a schema (schema)

# ### requires(name) 
# Returns a "has" object as a required schema property.
Schema::requires = (name) ->
  @has name,
    required: true



# ### has(name, [options])
# Returns a "has" object with no options by default.
Schema::has = (name, options) ->
  self = this
  reference =
    field: name
    options: options
    
    # #### one(schema) 
    one: (schema) ->
      @relation = "one"
      @relationName = ((str) ->
        str.charAt(0).toUpperCase() + str.slice(1)
      )(@field)
      @schema = schema
      self

    
    # #### many(schema)
    many: (schema) ->
      @relation = "many"
      @relationName = ((str) ->
        "{{parent}}" + str
      )(((str) ->
        str.slice 0, -1
      )(((str) ->
        str.charAt(0).toUpperCase() + str.slice(1)
      )(@field)))
      @schema = schema
      self

  @references.push reference
  reference

exports["new"] = (_mongoose, obj) ->
  mongoose = _mongoose
  new Schema(obj)
