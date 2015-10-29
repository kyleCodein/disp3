var db = require("../db");
var refreshCache = 1;
var cache = {};
var log = require("../lib/log");
var defaultPlatform = "sms99";
var prefix = "";
var libDate = require('../lib/date');
var COUNT = 3;

function setPlatform(platform) {
	defaultPlatform = platform;
}

function setPrefix(p) {
	prefix = p;
}

function refreshTpl(fn) {
	db.getModel("smstpl").bselect({}, function(err, tpls) {
		if (err) return fn(err);
		for (var i in tpls) {
			cache[tpls[i].tplid] = tpls[i];
		}
		refreshCache = 0;
		fn();
	});
}

function getTpl(tplid, fn) {
	if (refreshCache)
		refreshTpl(function(err) {
			if (err) return fn(err);
			return fn(null, cache[tplid] || {});
		});
	else
		return fn(null, cache[tplid] || {});
}

function addTpl(json, fn) {
	if (!json.tplid) return fn("no tplid");
	db.getModel("smstpl").upsert({
		tplid: json.tplid
	}, {
		content: json.content
	}, function(err) {
		if (err) return fn(err);
		refreshCache = 1;
		fn();
	});
}
/*
ip
tplid
...
phone
platform yuntong
*/
function send(params, fn) {
	var today = libDate.getDate(new Date());
	if (!params.ip) return fn('没有IP');
	if (!params.tplid) return fn("没有指定模板");
	if (!params.phone) return fn("没有手机号");
	var record_sms = db.getModel("record_sms");
	var smsDaily = db.getModel("record_sms_daily");
	var ip = params.ip;
	var tplid = params.tplid;
	getTpl(tplid, function(err, tpl) {
		if (err) return fn(err);
		if (!tpl.content) return fn("tplid error, please add tplid " + tplid + " into schema smstpl");
		var newparams = {
			// tpl: tpl,
			// code: params.code,
			phone: params.phone
		};
		newparams.msg = prefix + tpl.content.replace(/%([^%]+)%/g, function(str, p1) {
			return params[p1];
		});
		var platform = params.platform || defaultPlatform;
		var p;
		try {
			p = require("./" + platform);
			if (!p.sendsms) return fn("not method send in platfrom");
		} catch (e) {
			log.e(e);
			return fn("platform " + platform + " is not found");
		}

		smsDaily.select({
			ip: ip,
			date: today
		}, function(err, doc) {
			if (err) return fn(err);
			smsDaily.upsert2({
				ip: ip,
				date: today
			}, {
				$inc: {
					counts: 1
				}
			}, function(err, result) {
				if (err) return fn(err);
				if (!doc || (doc.counts && doc.counts < COUNT)) {
					p.sendsms(newparams, function(err, result) {
						var refid = parseInt(result);
						var insertObj = {
							phone: params.phone,
							tplid: tplid,
							refid: refid,
							state: 1
						}
						if (err) {
							fn(err);
							insertObj.state = 2;
							record_sms.insert(insertObj, function(insert_err) {
								if (insert_err) return fn(insert_err);
							});
						}
						record_sms.insert(insertObj, function(err, result) {
							if (err) return fn(err);
							fn(null, {
								success: true
							});
						});
					});
				} else {
					record_sms.update({
						phone: params.phone
					}, {
						state: 2
					}, function(err, result) {
						if (err) return fn(err);
						fn('当前ip发送发送短信超过上限');
					});
				}
			});
		});
	});
}
module.exports = {
	addTpl: addTpl,
	send: send,
	setPlatform: setPlatform,
	setPrefix: setPrefix
}