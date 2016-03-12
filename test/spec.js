/*
 * Copyright (c) 2016 Internet of Protocols Alliance (IOPA)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const iopa = require('../dest/iopa-core.js'),
    static = iopa.static,
    templates = iopa.templates,
    router = iopa.router,
    handlebars = iopa.handlebars,
    iopaUtil = iopa.util,
    stubServer = require('iopa-test').stubServer,
    should = require('should'),
    http = require('http'),

    constants = iopa.constants,
    IOPA = constants.IOPA,
    SERVER = constants.SERVER,
    METHODS = constants.METHODS,
    PORTS = constants.PORTS,
    SCHEMES = constants.SCHEMES,
    PROTOCOLS = constants.PROTOCOLS,
    APP = constants.APP,
    COMMONKEYS = constants.COMMONKEYS,
    OPAQUE = constants.OPAQUE,
    WEBSOCKET = constants.WEBSOCKET,
    SECURITY = constants.SECURITY;

describe('#IOPA Context and AppBuilder()', function() {

    var context, app, factory = new iopa.Factory({});

    it('should create empty context', function() {

        context = factory.createContext();

        (context.hasOwnProperty(IOPA.Version) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.CancelToken) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.Events) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.Seq) == -1).should.be.false;
        (context.hasOwnProperty(SERVER.Logger) == -1).should.be.false;
        (context.hasOwnProperty(SERVER.CancelTokenSource) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.Headers) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.Method) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.Host) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.Path) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.PathBase) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.Protocol) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.QueryString) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.Scheme) == -1).should.be.false;
        (context.hasOwnProperty(IOPA.Body) == -1).should.be.false;
        (context.hasOwnProperty("IGNOREME") == -1).should.be.true;

    });

    it('should create app that updates context using both signatures', function() {

        var test = new iopa.App();

        // use standard IOPA signature with context
        test.use(function(context, next) {
            context[IOPA.Method] = "GET";

            // continue to next middleware in pipeline
            return next();
        });

        // use fast IOPA signature with `this` set to context
        test.use(function(next) {
            this[IOPA.Method].should.equal("GET");
            this[IOPA.Method] = "PUT";

            // show as complete
            return Promise.resolve("ABC");
        });

        app = test.build();

    });


    it('should call app with context updated', function(done) {

        var context = factory.createContext();

        app(context).then(function(value) {
            context[IOPA.Method].should.equal("PUT");
            context.dispose();
            (context[IOPA.Method] == null).should.be.true;
            value.should.equal("ABC");
            done();
        })
    });

    it('should dispose context after running an AppFunc', function(done) {

        var context = factory.createContext();

        context.using(app).then(function(value) {
            value.should.equal("ABC");
            process.nextTick(function() {
                (context[IOPA.Method] == null).should.be.true;
                done();
            });
        })
    });

    it('should dispose context after satisfying a promise', function(done) {

        var context = factory.createContext();

        context.using(
            (app(context).
                then(function(value) {
                    context[IOPA.Method].should.equal("PUT");
                    return value;
                }))
        )
            .then(function(value) {
                process.nextTick(function() {
                    (context[IOPA.Method] == null).should.be.true;
                    value.should.equal("ABC");
                    done();
                });
            })
    });

});

describe('#CancellationTokenSource()', function() {

    var tokensource, token;

    it('should create new cancellation token', function() {

        tokensource = new iopaUtil.CancellationTokenSource();
        tokensource.isCancelled.should.equal(false);
    });

    it('should create new  token', function() {

        token = tokensource.token;
        token.isCancelled.should.equal(false);
    });

    it('should register a callback and cancel a token', function(done) {
        token.onCancelled(function(reason) {
            reason.should.equal(IOPA.EVENTS.Disconnect);
            process.nextTick(done);
        });
        tokensource.cancel(IOPA.EVENTS.Disconnect);
        token.isCancelled.should.equal(true);
        tokensource.isCancelled.should.equal(true);
    });

});

describe('#IOPA Router()', function() {

    var seq = 0;

    it('should handle router', function(done) {

        var app = new iopa.App();
        app.use(router);

        app.get('/goodbye', function(context, done) {
            context.response["iopa.Body"].end("<HTML><HEAD></HEAD><BODY>Goodbye World</BODY>");
            return done();
        });

        app.get('/', function(context, done) {
            context.response["iopa.Body"].end("<HTML><HEAD></HEAD><BODY>Hello World</BODY>");
            return done();
        });

        var server = stubServer.createServer(app.build())

        var context = server.receive();
        var responseBody = context.response["iopa.Body"].toString();
        responseBody.should.containEql('Hello World');
        done();
    });
});

describe('#IOPA Templates ()', function() {

    it('Template Engine Core', function(done) {
        var app = new iopa.App();

        app.use(templates);

        app.engine('.core', function(view, options, callback) {
            callback(null, '<!doctype html><html><head></head><body><h1>Hello World</h1></body></html>');
        });


        app.use(function(context, next) {
            return context.render('home.core');
        });

        var server = stubServer.createServer(app.build())

        var context = server.receive();
        context.response["iopa.Body"].on('finish', function() {
            var responseBody = context.response["iopa.Body"].toString();
            responseBody.should.containEql('<h1>Hello World</h1>');
            done();
        });
    });

    it('Handlebars Template Engine', function(done) {
        var app = new iopa.App();
        app.use(templates);
        app.engine('.hbs', handlebars({ defaultLayout: 'main', views: 'test/views' }));

        app.use(function(context, next) {
            return context.render('home.hbs');
        });

        var server = stubServer.createServer(app.build())

        var context = server.receive();
        context.response["iopa.Body"].on('finish', function() {
            var responseBody = context.response["iopa.Body"].toString();
            responseBody.should.containEql('<title>Example App</title>');
            responseBody.should.containEql('<h1>Example App: Home</h1>');
            done();
        });
    });
});

describe('#IOPA Static Server()', function() {

    var seq = 0;

    it('should serve Static', function(done) {

        var app = new iopa.App();
        app.use(static(app, './test/public', { 'sync': true }));

        var server = stubServer.createServer(app.build())

        var context = server.receive();
        var responseBody = context.response["iopa.Body"].toString();
        responseBody.should.equal('Hello World');
        done();
    });
});

describe('#IOPA Connect()', function() {

    var successServer = 0;
    var server1;

    it('should create an HTTP Listener app', function(done) {

        var app = new iopa.App();

        app.use(function(context, next) {
            context["iopa.Method"].should.equal("GET");
            context["iopa.Path"].should.equal("/");
            context.response.writeHead(200, { 'Content-Type': 'text/html' });
            context.response.end("<html><head></head><body>Hello World from HTTP Server</body></html>");

            return next().then(function() { successServer++; });
        });

        server1 = http.createServer(app.buildHttp()).listen(8000);


        done();

    });

    it('should call HTTP server and receive expected result', function(done) {

        var options = {
            host: 'localhost',
            path: '/',
            port: '8000',
            method: 'GET'
        };

        var callback = function(response) {
            var str = ''
            response.on('data', function(chunk) {
                str += chunk;
            });

            response.on('end', function() {
                str.should.equal("<html><head></head><body>Hello World from HTTP Server</body></html>");
                successServer.should.equal(1);
                server1.close(done);
            });
        }

        var req = http.request(options, callback);
        req.end();


    });

    var IsListening = false;
    it('should create an HTTP Listener app with connect format', function(done) {

        var app = new iopa.App();

        app.use(function(req, res) {
            req.method.should.equal("GET");
            req.url.should.equal("/");
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end("<html><head></head><body>Hello World from HTTP Server</body></html>");
            successServer++
        });

        server1 = http.createServer(app.buildHttp()).listen(8001);
        IsListening = true;

        done();

    });

    it('should call HTTP server and receive expected result', function(done) {

        var options = {
            host: 'localhost',
            path: '/',
            port: '8001',
            method: 'GET'
        };

        var callback = function(response) {
            var str = ''
            response.on('data', function(chunk) {
                str += chunk;
            });

            response.on('end', function() {
                str.should.equal("<html><head></head><body>Hello World from HTTP Server</body></html>");
                successServer.should.equal(2);
                server1.close();
                done();
            });
        }
        if (IsListening) {
            var req = http.request(options, callback);
            req.end();
        } else
            throw new Error("test cannot run unless previous test is successful");

    });

});

