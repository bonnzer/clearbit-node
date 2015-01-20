'use strict';

var createError  = require('create-error');
var EventEmitter = require('events').EventEmitter;
var _            = require('lodash');
var Promise      = require('bluebird');

function isQueued (err) {
  return err.type === 'queued';
}

function isUnknownRecord (err) {
  return err.type === 'unknown_record';
}

function ClearbitResource (data) {
  _.extend(this, data);
}

ClearbitResource.extractParams = function(params) {
  return _.omit(params || {}, 'path', 'method', 'params', 'client', 'api', 'stream');
};

ClearbitResource.get = Promise.method(function (path, options) {
  options = _.extend({
    path:   path,
    method: 'get',
    params: this.extractParams(options)
  }, this.options, options || {});

  return this.client.request(options)
    .bind(this)
    .then(function (data) {
      return new this(data);
    })
    .catch(isQueued, function () {
      throw new this.QueuedError(this.name + ' lookup queued');
    })
    .catch(isUnknownRecord, function () {
      throw new this.NotFoundError(this.name + ' not found');
    });
});

ClearbitResource.post = Promise.method(function (path, options) {
  options = _.extend({
    path:   path,
    method: 'post',
    query:  this.extractParams(options)
  }, this.options, options || {});

  return this.client.request(options)
    .bind(this)
    .catch(isUnknownRecord, function () {
      throw new this.NotFoundError(this.name + ' not found');
    });
});

function createErrors (name) {
  return {
    NotFoundError: createError(name + 'NotFoundError'),
    QueuedError: createError(name + 'QueuedError')
  };
}

exports.create = function (name, options) {
  var Resource = function () {
    ClearbitResource.apply(this, arguments);
  };

  _.extend(Resource,
           new EventEmitter(),
           EventEmitter.prototype,
           ClearbitResource,
           createErrors(name), {
    name: name,
    options: options
  });

  return _.extend(function (client) {
    return _.extend(Resource, {
      client: client
    });
  },
  {
    on: function () {
      Resource.on.apply(Resource, arguments);
      return this;
    },

    include: function (props) {
      _.extend(Resource.prototype, props);
      return this;
    },

    extend: function (props) {
      _.extend(Resource, props);
      return this;
    }
  });
};
