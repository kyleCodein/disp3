var fs = require("fs");
var path = require("path");
var libString = require("../lib/js/string");
var libArray = require("../lib/js/array");
var libObject = require("../lib/js/object");
var libFile = require("../lib/nodejs/file");
var log = require("./log");
var methods = {};
libObject.extend1(methods, libString);
libObject.extend1(methods, libArray);
libObject.extend1(methods, libObject);
libObject.extend1(methods, libFile);

var tmplCache = {};
module.exports.render = render;
function render(config, data){
	if(!data){
		log.e("render with undefined data");
		return "";
	};
	if(data.p || data.originstr || data.evalstr){
		log.e(config);
		log.e("variable p, originstr, evalstr is not allowed!!!!");
		return "";
	}
	var originstr;
	if(typeof config == "string"){
		originstr = config;
	}else{
		if(tmplCache[config.file]){
			originstr = tmplCache[config.file];
		}else{
			if(config.str && config.file) {
				originstr = config.str;
				tmplCache[config.file] = originstr;
			}
			else if(config.file){
				originstr = libFile.readString(config.file);
			}
			else if(config.str){
				originstr = config.str;
			}else{
				log.e("wrong param to render");
				return "";
			}
		}
	}
	data.local = data;
	data.$ = methods;
	data.p=[];

	var win, wout;
	var evalstr = "p.push('";
	with(data){
		originstr = originstr.replace(/\r/g,"");
		//		str = str.
		//			replace(/\s*(\^\^[^=]((?!\$\$).)*\$\$)\s*/g, "$1");
		//replace multiple line [\s but not \n]* [^^] [not =] [not $$]* [$$] [\s*\n] 

		originstr.split("\^\^").forEach(function(sub, i){
			if(i==0){
				win = "";
				wout = sub || "";
			}else{
				var subs = sub.split("\$\$");
				win = subs[0];
				wout = subs[1] || "";
			}

			wout = wout
				.replace(/\n[\t ]+$/, "\n") //remove \s after last \n
				.replace(/^[\t ]*\n/, "") // remove \s before/and first \n
				.replace(/\\([\[\]\{\}a-zA-Z0-9\+'])/g, "\\\\$1")
				.replace(/\n/g, "\\n")
				.replace(/'/g, "\\'")
				.replace(/\\([\"\?\*\/])/g, "\\\\\\$1");

			if(win && win[0] == '='){
				var ms;
//automatic init
				if((ms=win.match(/^=([A-Za-z0-9-]+)$/)))
					if(!data[ms[1]]){
						data[ms[1]] = "";
					}
				evalstr += (win.replace(/^=(.+)/, "',$1,'") + wout);
			}
			else{
				evalstr+=("');"+win+";p.push('"+wout);
			}
		});
		evalstr+="');";
		try{
			eval(evalstr);
		}catch(e){
			console.log(evalstr);
			log.e(config);
			log.e(e.stack);
			eval(evalstr);
			return "";

		}
	}
	var rtstr = data.p.join('');
	delete(data.p);
	return rtstr;
}
