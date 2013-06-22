var reOrigin = /^(?:\w+\:)?(?:\/\/)([^\/]*)/;
var channels = {};

if(window.attachEvent) window.attachEvent("onmessage", window_onmessage);
else window.addEventListener("message", window_onmessage, false);

function window_onmessage(e){
	var message = e.data;
	
	if(!(e.origin in channels)) return;

	var channel = channels[e.origin];

	if(e.source !== channel.iframe.contentWindow) return;

	if(typeof message !== 'string') return;
	if(message[0] !== '{') return;

	message = JSON.parse(e.data);
	
	channel.statechange(message);
}

function resolveUrl(url) {
	var a = document.createElement('a');
	a.href = url;
	return a.href;
}

function registerChannel(iframeUrl) {
	iframeUrl = resolveUrl(iframeUrl);
	var match = reOrigin.exec(iframeUrl);
	if(!match) throw 'invalid iframeUrl';

	var channel = {
		origin: match[0]
		, iframeUrl: iframeUrl
		, proxies: {}
	}

	channel.statechange = function(state){
		var proxy;
		var responseHeaders;

		if(!(state.id in channel.proxies)) return;

		proxy = channel.proxies[state.id];
		responseHeaders = parseHeaders(state.responseHeaders)

		if(state.readyState === 4) delete channel.proxies[state.id];

		proxy.readyState = state.readyState;
		proxy.status = state.statusCode;
		proxy.statusText = state.statusText;
		proxy.responseText = state.responseBody;

		proxy.getAllResponseHeaders = function() {
			return state.responseHeaders;
		}
		proxy.getResponseHeader = function(name) {
			name = name.toLowerCase();
			if(!(name in responseHeaders)) return undefined
			return responseHeaders[name];
		}
		proxy.onreadystatechange.apply(proxy);
	}

	channels[channel.origin] = channel;
}//registerChannel

function openChannel(origin, cb){
	if(!(origin in channels)) registerChannel(origin + '/xhr-channel.html');	

	var channel = channels[origin];

	if(channel.ready) return cb(null, channel);

	if('callbackQueue' in channel) return channel.callbackQueue.push(cb);

	channel.callbackQueue = [cb];

	channel.iframe = document.createElement('iframe');

	function channel_onload(){
		var cb;

		channel.ready = true;
		while(cb = channel.callbackQueue.shift()) {
			cb(null, channel);
		}
	}//onload

	if(channel.iframe.attachEvent) channel.iframe.attachEvent("onload", channel_onload);
	else channel.iframe.addEventListener("load", channel_onload, false);
	
	channel.iframe.src = channel.iframeUrl;
	channel.iframe.style.display = 'none';
	document.scripts[0].parentNode.insertBefore(channel.iframe, document.scripts[0]);	

}//openChannel




var idSequence = 0;
function XMLHttpRequestProxy(){
	var id = (++idSequence).toString(36);
	var proxy = this;
	var origin = null;

	var options = {
		id: id
		, requestHeaders: {}
	}

	this.onreadystatechange = null
	this.readyState = 0;
	this.responseText = null;
	//this.responseXML = null;
	this.status = null;
	this.statusText = null;


	this.open = function(method, url, async, username, password){
		if(async === false) throw 'only asynchronous behavior is supported';

		url = resolveUrl(url);
		var match = reOrigin.exec(url);
		if(!match) throw 'invalid url';

		origin = match[0];

		options.method = method
		options.url = url
		options.username = username
		options.password = password	
	}
	
	this.send = function(data) {
		options.requestBody = data;
		
		window.openChannel(origin, function(err, channel){
			if(err) throw err;
			
			channel.proxies[id] = proxy;
			channel.iframe.contentWindow.postMessage(JSON.stringify(options), channel.origin);
		})
	}
	this.abort = function() {
		getXhr(function(err, xhr){
			xhr.abort();
		});
	}

	this.setRequestHeader = function(name, value) {
		options.requestHeaders[name] = value;
	}
	this.getAllResponseHeaders = function() {
		return;
	}
	this.getResponseHeader = function(name) {
		return;
	}

}//XMLHttpRequestProxy

if(document.documentMode && document.documentMode < 10) {
	XMLHttpRequest = XMLHttpRequestProxy;
}

