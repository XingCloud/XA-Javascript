/**
 * Copyright XingCloud Information Technology Co., Ltd
 *
 *	Usages:
 *	
 *	var xa = new XA();
 *	//xa.waitForUid();
 *	xa.init({
 *		appid:'test_xa',
 *		uid:'test_user'
 *	});
 *
 */


/*
var xa = new XA();
xa.waitForUid();
xa.init({
	appid:'test_xa',
	uid:'test_user',
	logLevel:1
});
*/

function XA() {
	var instance = (function() {
		var uid  = getCookie('uid'),
			appid,
			refrence,
			logLevel,
			autoHeartBeat,
			waitForUid = false,
			uidSet = false,
			visitSent = false,
			domain = document.domain,
			rootId = 'xa-root',
			pageOpen = new Date(),
			host = document.location.protocol + '//analytic.337.com/',
			hbInterval = 1000*60*5,
			hb,
			cexp = pageOpen.getTime() + ( 1000 * 60 * 60 * 24 * 30 * 12 ),
			pool = [],
			poolSize = 5,
			poolTime = 10*1000,
			poolInterval;

		/**
		 * 	如果uid不存在，则生成一个，并存放在cookie中	
		 */
		if(!uid){
			uid = Math.round(Math.random()*2147483647)+"_"+Math.round(Math.random()*2147483647);
			setCookie('uid',uid);
		}
		
		/**	
		 * init方法，接收初始化参数，打page.view,选择性打user.visit	
		 */
		function _init(args){
			if(!args||!args.appid){
				throw 'appid empty!';
			}
			if(args.uid){
				uid = args.uid;
				uidSet = true;
			}
						
			appid = args.appid;
			refrence = args.refrence; 
			logLevel = args.logLevel||0;
			waitForUid = args.waitForUid;
			autoHeartBeat = args.autoHeartBeat;

			if(autoHeartBeat){
				_startHeartBeat();
			}
			
			//创建一个iframe,一方面打一个统计，另外可以给post方法提供target
			if(!document.getElementById(rootId)){
				(function(){
					//create hidden root for xa
					var _root = document.createElement('div');
					_root.id = rootId;
					var style = _root.style;
				    style.position = 'absolute';
				    style.top      = '-10000px';
				    style.width    = style.height = 0;
				    /*
				     * Create a temp Iframe for PageView and Post 
				     */
				    var iframe = document.createElement('iframe'),_parsms = null;
				    _parsms = {
				    		signedParams:{appid:appid,uid:uid,timestamp:_time()},
				    		stats:[{eventName:'page.view',params:{}}]
				    };
				    
				    iframe.src = host + _time() + '/static.gif?json='+encodeURIComponent(_toJson(_parsms));
				    iframe.id = iframe.name = rootId+"-iframe";
				    iframe.style.border = 'none';
				    iframe.style.overflow = 'hidden';
				    _root.appendChild(iframe);
				    
				    document.body.appendChild(_root);
				})();
			}
			
			poolInterval = setInterval(_clearPool, poolTime);

			if(!waitForUid){
				_visit(uid);	
			}else if(uidSet){
				_visit(uid);	
			}		
		}
		
		
		/**
		 * 用户visit事件，要检查一下uidSet值，如果已经set过了 TODO:检查一下
		 */
		function _visit(_uid){
			if(!visitSent){
				_trackEvent("user.visit",{ref:refrence});
			}
			visitSent = true;
		}
		
		/**
		 * 查询cookie
		 */
		function getCookie(name){
			var cookie = document.cookie.match('\\bxas_' + appid + '_'+name+ '="([^;]*)\\b'),val;
			if(cookie){
				val = cookie[1];
			}
			return val;
		}
		
		/**
		 * 设置cookie
		 */
		function setCookie(name,val){
		    document.cookie = 'xas_' + appid + '_'+name+'="' + val + '"' + '; expires=' + cexp + (domain ? '; domain=.' + domain : '');
		}

		/**
		 * 删除Cookie
		 */
		function delCookie(name){
		    var exp = new Date();
		    exp.setTime (exp.getTime() - 1);
		    var cval = getCookie (name);
		    document.cookie = 'xas_' + appid + '_'+name + "=" + cval + "; expires="+ exp.toGMTString();
		}
		
		/**
		 * 开始心跳记录发送
		 */		
		function _startHeartBeat(){
			if(!hb){
				hb = setInterval(function(){
					if(waitForUid&&!uidSet){
						return;
					}
					_trackEvent("user.heartbeat",{});
				}, hbInterval);
			}
			if(waitForUid&&!uidSet){
				return;
			}					
			_trackEvent("user.heartbeat",{});
		}
		
		/**
		 * 停止心跳记录发送
		 */
		function _stopHeartBeat(){
		    clearInterval(hb);
		    hb = null;
		};
		
		/**
		 * 得到当前时间
		 */
		function _time() {
			return (new Date()).getTime();
		};

		/**
		 * 发送事件
		 */
		function _trackEvent(eventName,params){
			var stats = {eventName:eventName,params:params,timestamp:_time()};
	    	pool.push(stats);
	    	if(pool.length>=poolSize){
	    		_clearPool();
	    	}
		};
		
		/**
		 * json编码回去
		 */
		function _toJson(obj){
		    if (window.Prototype && Object.toJSON) {
		        return Object.toJSON(obj);
		      } else {
		        return JSON.stringify(obj);
		    }
		}
		
		/**
		 * 发送事件的实现，通过图片方式。如果url过长，则改为post方式
		 */
		function _send(params,onload,onerror){
			if(typeof appid == 'undefined'){
				throw 'appid is undefined.';
			}
			
			var u = host + _time() + '/static.gif',
				i = new Image(1, 1),
				s = [];
			
			u += '?json=' + encodeURIComponent(_toJson(params));
			if(u.length>2000){
				_post(params,onload,onerror);
			}else{
				if (onload) {
					i.onload = onload;
				}
				if (onerror) {
					i.onerror = onerror;
				}
				i.src = u;	
			}
		}
		
		/**
		 * 用post方式发送事件的实现
		 */
		function _post(params,onload,onerror){
			
			var form = document.createElement('form');
		    form.action = host + 'index.php';
		    form.target = rootId+"-iframe";
		    form.method = 'POST';
		    
		    document.getElementById(form.target).onload = onload;
		    
		    var root = document.getElementById(rootId);
		    root.appendChild(form);
		    
		    var input = document.createElement('input');
	    	input.name = 'json';
	    	input.value = _toJson(params);;
	    	form.appendChild(input);
	    	
		    form.submit();
		    form.parentNode.removeChild(form);
		}
		
		/**
		 * 发送事件的实现，通过图片方式。如果url过长，则改为post方式
		 */
		function _clearPool(){
			var next = pool.shift(),stats = [],sp = null;
		    while (next) {
		    	stats.push(next);
		    	next = pool.shift();
		    }
		    if(stats.length==0)return;
		    sp = {appid:appid,uid:uid,timestamp:_time()};
		    
		    _send({signedParams:sp,stats:stats},function(){
		    	_writeLog('XA sent:');
		    	_writeLog({signedParams:sp,stats:stats});
		    },function(){
		    	_writeLog('XA error while sending:');
		    	_writeLog({signedParams:sp,stats:stats});
		    })
		}
		
		/**
		 * log方法
		 */
		function _writeLog(args){
			if(logLevel){
				if (window.Debug && window.Debug.writeln) {
		            window.Debug.writeln(args);
		        } else if (window.console) {
		            window.console.log(args);
		        }	
			}
		}
		
		/*	return 内容均为public方法	*/
		return {
		    getUid : function () {
		        return uid;
		    },
		    setUid : function (a) {
		        uid = a;
		        _visit(a);
				uidSet = true;
				if(autoHeartBeat){
					_startHeartBeat();
				}
		    },
		    getAppid : function () {
		        return appid;
		    },
		    setAppid : function (a) {
		        appid = a
		    },
		    getRefrence : function () {
		        return refrence;
		    },
		    setRefrence : function (a) {
		        refrence = a;
		    },
		    getLogLevel : function () {
		        return logLevel;
		    },
		    setLogLevel : function (a) {
		        logLevel = a;
		    },
		    setAutoHeartBeat:function(a){
		    	autoHeartBeat = a;
		    	if(a){
		    		_startHeartBeat();
		    	}else{
		    		_stopHeartBeat();	
		    	}
		    },
		    getAutoHeartBeat:function(){
		    	return autoHeartBeat;
		    },
		    trackEvent:function(eventName,params){
		    	_trackEvent(eventName,params);
		    },
		    init:function(args){
		    	_init(args);
		    }
		};
	})();

	XA = function() {return instance;};
	return XA();
}
//Json2 impl
if(!this.JSON){this.JSON={};(function(){function k(b){return b<10?"0"+b:b}function o(b){p.lastIndex=0;return p.test(b)?'"'+b.replace(p,function(b){var c=r[b];return typeof c==="string"?c:"\\u"+("0000"+b.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+b+'"'}function l(b,i){var c,d,h,m,g=e,f,a=i[b];a&&typeof a==="object"&&typeof a.toJSON==="function"&&(a=a.toJSON(b));typeof j==="function"&&(a=j.call(i,b,a));switch(typeof a){case "string":return o(a);case "number":return isFinite(a)?String(a):"null";case "boolean":case "null":return String(a);
case "object":if(!a)return"null";e+=n;f=[];if(Object.prototype.toString.apply(a)==="[object Array]"){m=a.length;for(c=0;c<m;c+=1)f[c]=l(c,a)||"null";h=f.length===0?"[]":e?"[\n"+e+f.join(",\n"+e)+"\n"+g+"]":"["+f.join(",")+"]";e=g;return h}if(j&&typeof j==="object"){m=j.length;for(c=0;c<m;c+=1)d=j[c],typeof d==="string"&&(h=l(d,a))&&f.push(o(d)+(e?": ":":")+h)}else for(d in a)Object.hasOwnProperty.call(a,d)&&(h=l(d,a))&&f.push(o(d)+(e?": ":":")+h);h=f.length===0?"{}":e?"{\n"+e+f.join(",\n"+e)+"\n"+
g+"}":"{"+f.join(",")+"}";e=g;return h}}if(typeof Date.prototype.toJSON!=="function")Date.prototype.toJSON=function(){return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+k(this.getUTCMonth()+1)+"-"+k(this.getUTCDate())+"T"+k(this.getUTCHours())+":"+k(this.getUTCMinutes())+":"+k(this.getUTCSeconds())+"Z":null},String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(){return this.valueOf()};var q=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
p=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,e,n,r={"\u0008":"\\b","\t":"\\t","\n":"\\n","\u000c":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},j;if(typeof JSON.stringify!=="function")JSON.stringify=function(b,i,c){var d;n=e="";if(typeof c==="number")for(d=0;d<c;d+=1)n+=" ";else typeof c==="string"&&(n=c);if((j=i)&&typeof i!=="function"&&(typeof i!=="object"||typeof i.length!=="number"))throw Error("JSON.stringify");return l("",
{"":b})};if(typeof JSON.parse!=="function")JSON.parse=function(b,e){function c(b,d){var g,f,a=b[d];if(a&&typeof a==="object")for(g in a)Object.hasOwnProperty.call(a,g)&&(f=c(a,g),f!==void 0?a[g]=f:delete a[g]);return e.call(b,d,a)}var d;q.lastIndex=0;q.test(b)&&(b=b.replace(q,function(b){return"\\u"+("0000"+b.charCodeAt(0).toString(16)).slice(-4)}));if(/^[\],:{}\s]*$/.test(b.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,
"]").replace(/(?:^|:|,)(?:\s*\[)+/g,"")))return d=eval("("+b+")"),typeof e==="function"?c({"":d},""):d;throw new SyntaxError("JSON.parse");}})();
}
