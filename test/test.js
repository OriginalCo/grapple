var should = require('should')
  , mongoose = require('mongoose')
  , schema = require('../')
  
describe('grapple', function() {

  var doesSchemaExist = function(name) {
      var Schema = getSchema(name)
      Schema.should.have.property('modelName')
      Schema.modelName.should.eql(name)
      return Schema
    }
    ,getSchema = function(name) {
      return mongoose.model(name)
    }
    ,emptySchema = function(name, done) {
      var Schema = getSchema(name)
      Schema.find('{}').remove(function(err) {
        if(done) done() 
      })
    }

  before(function(done) {
    mongoose.connect('mongodb://localhost/grapple_dev')
    done()
  })

  it('should register a Mongoose schema with primitive datatypes', function(done) {
    schema.new(mongoose, {
        name: {type: String, default: '', trim: true}
      })
      .compile('SimpleSchema') 
      doesSchemaExist('SimpleSchema')
    done()
  })

  it('should register a Mongoose schema with a nested reference', function(done) {
    schema.new(mongoose, {
        name: {type: String, default: '', trim: true}
      })
      .has('simpleSchema').one('SimpleSchema')
      .compile('NestedSchemaHasOne')
    doesSchemaExist('NestedSchemaHasOne')
    done()
  })

  it('should register a Mongoose schema with a collection of nested references', function(done) {
    schema.new(mongoose, {
        name: {type: String, default: '', trim: true}
      })
      .has('simpleSchemas').many('SimpleSchema')
      .compile('NestedSchemaHasMany')
    doesSchemaExist('NestedSchemaHasMany')
    done()
  })

  it('should register a Mongoose schema with a nested reference to a dynamic schema', function(done) {
    schema.new(mongoose, {
        name: {type: String, default: '', trim: true}
      })
      .has('simpleDynamicSchema').one(schema.new(mongoose, {
        name: {type: String, default: '', trim: true}
      }))
      .compile('NestedSchemaHasOneDynamic')
    doesSchemaExist('NestedSchemaHasOneDynamic')
    doesSchemaExist('SimpleDynamicSchema')
    done()
  }) 

  it('should register a Mongoose schema with a collection of nested references to a dynamic schema', function(done) {
    schema.new(mongoose, {
        name: {type: String, default: '', trim: true}
      })
      .has('simpleDynamicSchemas').many(schema.new(mongoose, {
        name: {type: String, default: '', trim: true}
      }))
      .compile('NestedSchemaHasManyDynamic')
    doesSchemaExist('NestedSchemaHasManyDynamic')
    doesSchemaExist('NestedSchemaHasManyDynamicSimpleDynamicSchema')
    done()
  }) 

  it('should register plugins on the schema', function(done) {
    schema.new(mongoose, {
        name: {type: String, default: '', trim: true}
      })
      .plugin(require('./support/plugin'))
      .compile('SchemaWithPlugin')
    doesSchemaExist('SchemaWithPlugin')
    done()
  })

  it('should run configure, accepting a lambda with the the f(schema) signature', function(done) {
    var didPreSaveRun = false
    schema.new(mongoose, {
        name: {type: String, default: '', trim: true}
      })
      .configure(function(schema) {
        schema.pre('save', function(next) {
          didPreSaveRun = true
          next()
        })
      })
      .compile('SchemaWithConfigureMethod')
    var Schema = doesSchemaExist('SchemaWithConfigureMethod')
      , model = new Schema({ name: "Test" })
    model.save(function(err, obj) {
      didPreSaveRun.should.eql(true)
      Schema.findOne({ _id: obj._id }).remove(function(err, obj) {
        done()
      })
    })
  })

  it('should run configure, accepting a schema configuration object', function(done) {
    schema.new(mongoose, {
        name: {type: String, default: '', trim: true}
      })
      .configure({
        test: {type: String, default: '', trim: true}  
      })
      .compile('SchemaWithConfigureObject')
    var Schema = doesSchemaExist('SchemaWithConfigureObject')
      , model = new Schema({ name: "Test1", test: "Test2" })
    model.save(function(err, obj) {
      obj.test.should.eql('Test2')
      Schema.findOne({ _id: obj._id }).remove(function(err, obj) {
        done()
      })
    })
  })

  it('should allow methods to be defined on the model', function(done) {
    var didMethodRun = false
    schema.new(mongoose, {
        name: {type: String, default: '', trim: true}
      })
      .method('test', function() {
        didMethodRun = true
      })
      .compile('SchemaWithMethod')
    var Schema = doesSchemaExist('SchemaWithMethod')
      , model = new Schema({ name: "Test" })
    model.test()
    didMethodRun.should.eql(true)
    done()
  })

  it('should run the "out" method on the model', function(done) {
    var Schema = getSchema('SimpleSchema')
      , model = new Schema({ name: "Test" })
    model.save(function(err, obj) {
      obj.out(function(obj) {
        emptySchema('SimpleSchema', done)
      })
    })
  })

  it('should run the "in" method on the model', function(done) {
    var Schema = getSchema('SimpleSchema')
      , model = new Schema({ name: "Test" })
    model.save(function(err, obj) {
      obj.out(function(obj_out) {
        obj.in(obj_out, function(obj) {
          emptySchema('SimpleSchema', done)
        })
      })
    })
  })

  describe('lightweight method', function() {

    var Schema, model

    before(function(done) {
      schema.new(mongoose, {
          name: {type: String, default: '', trim: true}
        })
        .method('lightweight', function(done) {
          var obj = this.toObject()
          obj.name = "lightweight " + obj.name
          done(obj)
        })
        .compile('SimpleSchemaLightweight')
      Schema = doesSchemaExist('SimpleSchemaLightweight')
      model = new Schema({ name: "test"})
      model.save(function(err, obj) {
        model = obj
        done()
      })
    })

    it('should return the lightweight representation of the object when called', function(done) {
      model.lightweight(function(obj) {
        obj.name.should.eql("lightweight " + model.name)
        done()
      }) 
    })

    after(function() {
      emptySchema('SimpleSchemaLightweight')
    })

  })

  describe('sanitize method', function() {

    var Schema, Nested, SchemaLightweight, Subschema, SimpleSubschemaLightweight, SubschemaLightweight, model, nested

    before(function(done) {
      schema.new(mongoose, {
          name: {type: String, default: '', trim: true}
        })
        .method('lightweight', function(done) {
          var obj = this.toObject()
          obj.name = "lightweight " + obj.name
          done(obj)
        })
        .compile('SimpleSchemaWithLightweight')

      schema.new(mongoose, {
          name: {type: String, default: '', trim: true}
        })
        .has('simpleDynamicSchemaWithLightweightForSanitization').one(schema.new(mongoose, {
            name: {type: String, default: '', trim: true}
          })
          .method('lightweight', function(done) {
            var obj = this.toObject()
            obj.name = "lightweight " + obj.name
            done(obj)
          })
        )
        .has('simpleDynamicSchemaForSanitization').one(schema.new(mongoose, {
            name: {type: String, default: '', trim: true}
          })
        )
        .method('sanitize', function(done) {
          var obj = this.toObject()
          obj.name += " is sanitized"
          done(obj)
        })
        .compile('NestedSchemaHasOneDynamicSanitize')

      schema.new(mongoose, {
          name: {type: String, default: '', trim: true}
        })
        .has('simpleSchemaWithLightweights').many('SimpleSchemaWithLightweight')
        .compile('NestedSchemaHasManySimpleSchemaWithLightweight')
        
      Schema = doesSchemaExist('NestedSchemaHasOneDynamicSanitize')
      Nested = doesSchemaExist('NestedSchemaHasManySimpleSchemaWithLightweight')
      SchemaLightweight = doesSchemaExist('SimpleSchemaLightweight')
      Subschema = doesSchemaExist('SimpleDynamicSchemaForSanitization')
      SimpleSubschemaLightweight = doesSchemaExist('SimpleSchemaWithLightweight')
      SubschemaLightweight = doesSchemaExist('SimpleDynamicSchemaWithLightweightForSanitization')

      var sub = new Subschema({ name: "test subschema" })
        , simpleSubLightweight = new SimpleSubschemaLightweight({ name: "test simple subschema lightweight" })
        , subLightweight = new SubschemaLightweight({ name: "test subschema lightweight"})

      sub.save(function(err, obj) {
        simpleSubLightweight.save(function(err, obj) {
          subLightweight.save(function(err, obj) {
            nested = new Nested({
              name: "test",
              simpleSchemaWithLightweights: [
                simpleSubLightweight
              ]
            })
            nested.save(function(err, obj) {
              model = new Schema({ 
                name: "test",
                simpleDynamicSchemaForSanitization: sub,
                simpleDynamicSchemaWithLightweightForSanitization: subLightweight
              })
              model.save(function(err, obj) {
                done()
              })
            })
          })
        })
      })
    })

    it('should run when "out" is called and return the sanitized object', function(done) {
      model.out(function(obj) {
        obj.name.should.eql(model.name + " is sanitized")
        done()
      })
    })

    it('should run when "out" is called and call lightweight on subschemas', function(done) {
      model.out(function(obj) {
        obj.name.should.eql(model.name + " is sanitized")
        obj.simpleDynamicSchemaForSanitization.name.should.eql("test subschema")
        obj.simpleDynamicSchemaWithLightweightForSanitization.name.should.eql("lightweight test subschema lightweight")
        done()
      })
    })

    it('should run when "out" is called and call lightweight on nested subschemas', function(done) {
      nested.out(function(obj) {
        obj.name.should.eql(nested.name)
        obj.simpleSchemaWithLightweights[0].name.should.eql("lightweight test simple subschema lightweight")
        done()
      })
    })

    after(function() {
      emptySchema('NestedSchemaHasManySimpleSchemaWithLightweight')
      emptySchema('SimpleSchemaWithLightweight')
      emptySchema('SimpleSchemaLightweight')
      emptySchema('NestedSchemaHasOneDynamicSanitize')
      emptySchema('SimpleDynamicSchemaForSanitization')
      emptySchema('SimpleDynamicSchemaWithLightweightForSanitization')
    })
  })
})
