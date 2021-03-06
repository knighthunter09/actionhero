var should = require('should');
var request = require('request');
var actionheroPrototype = require(__dirname + "/../../actionhero.js").actionheroPrototype;
var actionhero = new actionheroPrototype();
var api;
var url

describe('Server: Web', function(){

  before(function(done){
    actionhero.start(function(err, a){
      api = a;
      url = 'http://localhost:' + api.config.servers.web.port;
      done();
    })
  });

  after(function(done){
    actionhero.stop(function(err){
      done();
    });
  });

  it('Server should be up and return data', function(done){
    request.get(url + '/api/', function(err, response, body){
      body = JSON.parse(body);
      body.should.be.an.instanceOf(Object);
      done();
    });
  });

  it('Server basic response should be JSON and have basic data', function(done){
    request.get(url + '/api/', function(err, response, body){
      body = JSON.parse(body);
      body.should.be.an.instanceOf(Object);
      body.requesterInformation.should.be.an.instanceOf(Object);
      done();
    });
  });

  it('params work', function(done){
    request.get(url + '/api/testAction/', function(err, response, body){
      body = JSON.parse(body);
      body.requesterInformation.receivedParams.action.should.equal('testAction')
      done();
    });
  });

  it('params are ignored unless they are in the whitelist', function(done){
    request.get(url + '/api/testAction/?crazyParam123=something', function(err, response, body){
      body = JSON.parse(body);
      body.requesterInformation.receivedParams.action.should.equal('testAction');
      should.not.exist(body.requesterInformation.receivedParams['crazyParam123']);
      done();
    });
  });

  it('limit and offset should have defaults', function(done){
    request.get(url + '/api/', function(err, response, body){
      body = JSON.parse(body);
      body.requesterInformation.receivedParams.limit.should.equal(100)
      body.requesterInformation.receivedParams.offset.should.equal(0)
      done();
    });
  });

  it('gibberish actions have the right response', function(done){
    request.get(url + '/api/IAMNOTANACTION', function(err, response, body){
      body = JSON.parse(body);
      body.error.should.equal('Error: IAMNOTANACTION is not a known action or that is not a valid apiVersion.')
      done();
    });
  });

  it('real actions do not have an error response', function(done){
    request.get(url + '/api/status', function(err, response, body){
      body = JSON.parse(body);
      should.not.exist(body.error);
      done();
    });
  });

  it('HTTP Verbs should work: GET', function(done){
    request.get(url + '/api/randomNumber', function(err, response, body){
      body = JSON.parse(body);
      body.randomNumber.should.be.within(0,1)
      done();
    });
  });

  it('HTTP Verbs should work: PUT', function(done){
    request.put(url + '/api/randomNumber', function(err, response, body){
      body = JSON.parse(body);
      body.randomNumber.should.be.within(0,10)
      done();
    });
  });

  it('HTTP Verbs should work: POST', function(done){
    request.post(url + '/api/randomNumber', function(err, response, body){
      body = JSON.parse(body);
      body.randomNumber.should.be.within(0,100)
      done();
    });
  });

  it('HTTP Verbs should work: DELETE', function(done){
    request.del(url + '/api/randomNumber', function(err, response, body){
      body = JSON.parse(body);
      body.randomNumber.should.be.within(0,1000)
      done();
    });
  });

  it('HTTP Verbs should work: Post with Form', function(done){
    request.post(url + '/api/cacheTest', {form: {key:'key', value: 'value'}}, function(err, response, body){
      body = JSON.parse(body);
      body.cacheTestResults.saveResp.should.eql(true);
      done();
    });
  });

  it('HTTP Verbs should work: Post with JSON Payload as body', function(done){
    var body = JSON.stringify({key:'key', value: 'value'});
    request.post(url + '/api/cacheTest', {'body': body, 'headers': {'Content-type': 'application/json'}}, function(err, response, body){
      body = JSON.parse(body);
      body.cacheTestResults.saveResp.should.eql(true);
      done();
    });
  });

  it('returnErrorCodes false should still have a status of 200', function(done){
    request.del(url + '/api/', function(err, response, body){
      body = JSON.parse(body);
      response.statusCode.should.eql(200);
      done();
    });
  });

  it('returnErrorCodes can be opted to change http header codes', function(done){
    api.config.servers.web.returnErrorCodes = true;
    request.del(url + '/api/', function(err, response, body){
      body = JSON.parse(body);
      response.statusCode.should.eql(404);
      api.config.servers.web.returnErrorCodes = false;
      done();
    });
  });

  describe('http header', function(){

    before(function(done){
      api.config.servers.web.returnErrorCodes = true;
      api.actions.versions.headerTestAction = [1]
      api.actions.actions.headerTestAction = {
        '1': {
          name: 'headerTestAction',
          description: 'I am a test',
          version: 1,
          inputs: { required: [], optional: [] },
          outputExample: {},
          run:function(api, connection, next){
            connection.rawConnection.responseHeaders.push(['thing', "A"]);
            connection.rawConnection.responseHeaders.push(['thing', "B"]);
            connection.rawConnection.responseHeaders.push(['thing', "C"]);
            connection.rawConnection.responseHeaders.push(['Set-Cookie', "value_1=1"]);
            connection.rawConnection.responseHeaders.push(['Set-Cookie', "value_2=2"]);
            next(connection, true);
          }
        }
      }
      done();
    });

    after(function(done){
      delete api.actions.actions['headerTestAction'];
      delete api.actions.versions['headerTestAction'];
      done();
    })

    it('duplicate headers should be removed (in favor of the last set)', function(done){
      request.get(url + '/api/headerTestAction', function(err, response, body){
        body = JSON.parse(body);
        response.statusCode.should.eql(200);
        response.headers['thing'].should.eql('C');
        done();
      });
    });

    it('but duplicate set-cookie requests should be allowed', function(done){
      request.get(url + '/api/headerTestAction', function(err, response, body){
        body = JSON.parse(body);
        response.statusCode.should.eql(200);
        response.headers['set-cookie'].length.should.eql(3); // 2 + session
        response.headers['set-cookie'][1].should.eql('value_1=1');
        response.headers['set-cookie'][0].should.eql('value_2=2');
        done();
      });
    });

    it('should respond to OPTIONS with only HTTP headers', function(done){
      request({method: 'options', url: url + '/api/x'}, function(err, response, body){
        response.statusCode.should.eql(200);
        response.headers['access-control-allow-methods'].should.equal('HEAD, GET, POST, PUT, DELETE, OPTIONS, TRACE');
        response.headers['access-control-allow-origin'].should.equal('*');
        response.headers['content-length'].should.equal('0');
        done();
      });
    });

    it('should respond to TRACE with parsed params received', function(done){
      request({method: 'trace', url: url + '/api/x', form: {key: 'someKey', value: 'someValue'}}, function(err, response, body){
        body = JSON.parse(body);        
        response.statusCode.should.eql(200);
        body.receivedParams.action.should.equal('x');
        body.receivedParams.key.should.equal('someKey');
        body.receivedParams.value.should.equal('someValue');
        done();
      });
    });

    it('should respond to HEAD requests just like GET, but with no body', function(done){
      request({method: 'head', url: url + '/api/headerTestAction'}, function(err, response, body){
        response.statusCode.should.eql(200);
        body.should.equal('');
        done();
      });
    });

    it('keeps sessions with browser_fingerprint', function(done){
      var j = request.jar()
      request.post({url: url+'/api', jar: j}, function(err, response1, body1){
        request.get({url: url+'/api', jar: j}, function(err, response2, body2){
          request.put({url: url+'/api', jar: j}, function(err, response3, body3){
            request.del({url: url+'/api', jar: j}, function(err, response4, body4){
              body1 = JSON.parse(body1);
              body2 = JSON.parse(body2);
              body3 = JSON.parse(body3);
              body4 = JSON.parse(body4);

              response1.headers['set-cookie'].should.exist;
              should.not.exist(response2.headers['set-cookie']);
              should.not.exist(response3.headers['set-cookie']);
              should.not.exist(response4.headers['set-cookie']);

              body1.requesterInformation.id.should.equal(body2.requesterInformation.id);
              body1.requesterInformation.id.should.equal(body3.requesterInformation.id);
              body1.requesterInformation.id.should.equal(body4.requesterInformation.id);
              done();
            });
          });
        });
      });
    });

  });

  describe('http returnErrorCodes true', function(){

    before(function(done){
      api.config.servers.web.returnErrorCodes = true;
      
      api.actions.versions.statusTestAction = [1]
      api.actions.actions.statusTestAction = {
        '1': {
          name: 'statusTestAction',
          description: 'I am a test',
          inputs: { required: ['key'], optional: [] },
          outputExample: {},
          run:function(api, connection, next){
            if(connection.params.key != 'value'){
              connection.error = 'key != value';
              connection.rawConnection.responseHttpCode = 402;
            } else {
              connection.response.good = true;
            }
            next(connection, true);
          }
        }
      }

      api.actions.versions.brokenAction = [1]
      api.actions.actions.brokenAction = {
        '1': {
          name: 'brokenAction',
          description: 'I am broken',
          inputs: { required: [], optional: [] },
          outputExample: {},
          run:function(api, connection, next){
            BREAK; // undefiend
            next(connection, true);
          }
        }
      }

      done();
    });

    after(function(done){
      api.config.servers.web.returnErrorCodes = false;
      delete api.actions.versions['statusTestAction'];
      delete api.actions.actions['statusTestAction'];
      delete api.actions.versions['brokenAction'];
      delete api.actions.actions['brokenAction'];
      done();
    });

    it('actions that do not exists should return 404', function(done){
      request.post(url + '/api/aFakeAction', function(err, response, body){
        body = JSON.parse(body);
        response.statusCode.should.eql(404);
        done();
      });
    });

    it('missing params result in a 422', function(done){
      request.post(url + '/api/statusTestAction', function(err, response, body){
        body = JSON.parse(body);
        response.statusCode.should.eql(422);
        done();
      });
    });

    it('server errors should return a 500', function(done){
      request.post(url + '/api/brokenAction', function(err, response, body){
        body = JSON.parse(body);
        response.statusCode.should.eql(500);
        done();
      });
    });

    it('status codes can be set for errors', function(done){
      request.post(url + '/api/statusTestAction', {form: {key: 'bannana'}}, function(err, response, body){
        body = JSON.parse(body);
        body.error.should.eql('key != value');
        response.statusCode.should.eql(402);
        done();
      });
    });

    it('status code should still be 200 if everything is OK', function(done){
      request.post(url + '/api/statusTestAction', {form: {key: 'value'}}, function(err, response, body){
        body = JSON.parse(body);
        body.good.should.eql(true);
        response.statusCode.should.eql(200);
        done();
      });
    });

  });

  describe('documentation', function(){

    it('documentation should be returned for web clients with no params', function(done){
      request.get(url + '/api/', function(err, response, body){
        body = JSON.parse(body);
        body.documentation.should.be.an.instanceOf(Object);
        done();
      });
    });

    it('should have actions with all the right parts', function(done){
      request.get(url + '/api/', function(err, response, body){
        body = JSON.parse(body);
        for(var actionName in body.documentation){
          for(var version in body.documentation[actionName]){
            var action = body.documentation[actionName][version];
            action.name.should.be.a.String;
            action.description.should.be.a.String;
            action.inputs.should.be.a.Object;
            action.inputs.required.should.be.an.instanceOf(Array)
            action.inputs.optional.should.be.an.instanceOf(Array)
            action.outputExample.should.be.a.Object;
          }
        }
        done();
      });
    });
    
  });

  describe('files', function(){

    it('file: an HTML file', function(done){
      request.get(url + '/public/simple.html', function(err, response, body){
        response.statusCode.should.equal(200);
        response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
        done();
      });
    });

    it('file: 404 pages', function(done){
      request.get(url + '/public/notARealFile', function(err, response, body){
        response.statusCode.should.equal(404)
        done();
      });
    });

    it('file: ?filename should work like a path', function(done){
      request.get(url + '/public?file=simple.html', function(err, response, body){
        response.statusCode.should.equal(200);
        response.body.should.equal('<h1>ActionHero</h1>\\nI am a flat file being served to you via the API from ./public/simple.html<br />');
        done();
      });
    });

    it('I should not see files outside of the public dir', function(done){
      request.get(url + '/public/?file=../config.json', function(err, response, body){
        response.statusCode.should.equal(404);
        response.body.should.equal(api.config.general.flatFileNotFoundMessage);
        done();
      });
    });

    it('file: index page should be served when requesting a path (trailing slash)', function(done){
      request.get(url + '/public/', function(err, response, body){
        response.statusCode.should.equal(200);
        response.body.should.be.a.String;
        done();
      });
    });

    it('file: index page should be served when requesting a path (no trailing slash)', function(done){
      request.get(url + '/public', function(err, response, body){
        response.statusCode.should.equal(200);
        response.body.should.be.a.String;
        done();
      });
    });

  });

  describe('routes', function(){
    
    before(function(done){
      api.routes.loadRoutes({
        all: [
          { path: '/user/:userID', action: 'user' }
        ],
        get: [
          { path: '/users', action: 'usersList' },
          { path: '/search/:term/limit/:limit/offset/:offset', action: 'search' },
          { path: '/c/:key/:value', action: 'cacheTest' },
          { path: '/mimeTestAction/:key', action: 'mimeTestAction' }
        ],
        post: [
          { path: '/login/:userID(^\\d{3}$)', action: 'login' }
        ]
      });

      api.actions.versions.mimeTestAction = [1]
      api.actions.actions.mimeTestAction = {
        '1': {
          name: 'mimeTestAction',
          description: 'I am a test',
          matchExtensionMimeType: true,
          inputs: { required: ['key'], optional: [] },
          outputExample: {},
          run:function(api, connection, next){
            next(connection, true);
          }
        }
      }

      done();
    });

    after(function(done){
      api.routes.routes = {};
      delete api.actions.versions['mimeTestAction'];
      delete api.actions.actions['mimeTestAction'];
      done();
    });

    it('new params will be allowed in route definitions', function(done){
      api.params.postVariables.should.include('userID');
      done();
    });

    it('\'all\' routes are duplicated properly', function(done){
      ['get', 'post', 'put', 'delete'].forEach(function(verb){
        api.routes.routes[verb][0].action.should.equal('user');
        api.routes.routes[verb][0].path.should.equal('/user/:userID');
      });
      done();
    })
  
    it('unknown actions are still unknown', function(done){
      request.get(url + '/api/a_crazy_action', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('a_crazy_action')
        body.error.should.equal('Error: a_crazy_action is not a known action or that is not a valid apiVersion.')
        done();
      });
    });

    it('explicit action declarations still override routed actions, if the defined action is real', function(done){
      request.get(url + '/api/user/123?action=randomNumber', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('randomNumber')
        done();
      });
    });

    it('route actions will override explicit actions, if the defined action is null', function(done){
      request.get(url + '/api/user/123?action=someFakeAction', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('user')
        done();
      });
    });

    it('Routes should be mapped for GET (simple)', function(done){
      request.get(url + '/api/users', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('usersList')
        done();
      });
    });

    it('Routes should be mapped for GET (complex)', function(done){
      request.get(url + '/api/user/1234', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        done();
      });
    });

    it('Routes should be mapped for POST', function(done){
      request.post(url + '/api/user/1234?key=value', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        body.requesterInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('Routes should be mapped for PUT', function(done){
      request.put(url + '/api/user/1234?key=value', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        body.requesterInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('Routes should be mapped for DELETE', function(done){
      request.del(url + '/api/user/1234?key=value', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('user')
        body.requesterInformation.receivedParams.userID.should.equal('1234')
        body.requesterInformation.receivedParams.key.should.equal('value')
        done();
      });
    });

    it('route params trump explicit params', function(done){
      request.get(url + '/api/search/SearchTerm/limit/123/offset/456?term=otherSearchTerm&limit=0&offset=0', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('search')
        body.requesterInformation.receivedParams.term.should.equal('SearchTerm')
        body.requesterInformation.receivedParams.limit.should.equal(123)
        body.requesterInformation.receivedParams.offset.should.equal(456)
        done();
      });
    });

    it('regexp matches will provide proper variables', function(done){
      request.post(url + '/api/login/123', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('login');
        body.requesterInformation.receivedParams.userID.should.equal('123');
        done();
      });
    });

    it('regexp matches will still work with params with periods and other wacky chars', function(done){
      request.get(url + '/api/c/key/log_me-in.com$123.jpg', function(err, response, body){
        body = JSON.parse(body);
        body.requesterInformation.receivedParams.action.should.equal('cacheTest');
        body.requesterInformation.receivedParams.value.should.equal('log_me-in.com$123.jpg');
        done();
      });
    });

    it('regexp match failures will be rejected', function(done){
      request.post(url + '/api/login/1234', function(err, response, body){
        body = JSON.parse(body);
        body.error.should.equal('Error: login is not a known action or that is not a valid apiVersion.');
        body.requesterInformation.receivedParams.action.should.equal('login');
        should.not.exist(body.requesterInformation.receivedParams.userID);
        done();
      });
    });

    describe('file extensions + routes', function(){

      it('will change header information based on extension (when active)', function(done){
        request.get(url + '/api/mimeTestAction/val.png', function(err, response, body){
          body = JSON.parse(body);
          response.headers['content-type'].should.equal('image/png');
          done();
        });
      });

      it('will not change header information if there is a connection.error', function(done){
        request.get(url + '/api/mimeTestAction', function(err, response, body){
          body = JSON.parse(body);
          response.headers['content-type'].should.equal('application/json; charset=utf-8');
          body.error.should.equal('Error: key is a required parameter for this action');
          done();
        });
      });

    });

  });

});
