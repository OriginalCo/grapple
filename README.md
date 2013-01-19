grapple
=======

NodeJS module that provides a way of creating Mongoose schemas with a bunch of added functionality. Check out the tests for all the fun stuff it can do.

sample schema
=============

```javascript

var schema = require('grapple')
  , mongoose = require('mongoose')

schema.new(mongoose, {
    name: String
    , email: { type: String, unique: true }
    , username: { type: String, unique: true }
    , provider: String
    , hashed_password: String
    , salt: String
  })

  .has('something').one('Thing')
  .has('things').many('Thing')

  .configure(function(schema) {
    schema
      .virtual('password')
      .set(function(password) {
        this._password = password
        this.salt = this.makeSalt()
        this.hashed_password = this.encryptPassword(password)
      })
      .get(function() { return this._password })
  })

  .method('authenticate', function(plainText) {
    return this.encryptPassword(plainText) === this.hashed_password
  })
  .method('makeSalt', function() {
    return Math.round((new Date().valueOf() * Math.random())) + ''
  })
  .method('encryptPassword', function(password) {
    return crypto.createHmac('sha1', this.salt).update(password).digest('hex')
  })

  .method('lightweight', function(done) {
    var obj = {
      _id: this._id
      ,name: this.name
      ,uri: '/people/' + this._id
    }
    done(obj)
  })

  .method('sanitize', function(done) {
    var obj = this.toObject()
    delete obj.salt
    delete obj.hashed_password
    obj.uri = '/people/' + obj._id
    done(obj)
  })

  .compile('User')

```
