var Database = require("./lib.js").Database;
var mongodb = require("mongodb");
var ObjectId = require("./lib.js").ObjectId;
var isArray = require("./lib.js").isArray;
var eachSync = require("./lib.js").eachSync;
var project = require("./lib.js").project;
var bcryptEncode = require("./lib.js").bcryptEncode;
module.exports.db = new Database(new function(){
	var self = this;
	var colDef = ;
	var colArray = Object.keys(colDef);
	var colCache = {};
	var colDataCache = {};
	var conn;
	var formatFuncs = {};
	self.makeFormat = function(config, flag){
		if(flag == "insert"){
			return function(doc){
				if(!config) return;
				for(var key in config.fields){
					var f = config.fields[key];
					if(f.hasOwnProperty("default") && !doc.hasOwnProperty(key)){
						if(f.default == "now")
							doc[key] = new Date().getTime();
						else
							doc[key] = f.default;
					}
					if(doc.hasOwnProperty(key)){
						if(f.type == "int"){
							doc[key] = parseInt(doc[key]);
						}
						if(f.type == "float"){
							doc[key] = parseFloat(doc[key]);
						}
						if(f.type == "string"){
							doc[key] = "" + doc[key];
						}
					}

				}
			}
		}
		return function(doc){
			if(!doc) return;
			if(doc._id) doc._id = ObjectId(doc._id);	
			for(var key in doc){
				if(key.match(/_id$/)){
					doc[key] = ObjectId(doc[key]);
				}
				if(key.match(/password$/)){
					doc[key] = bcryptEncode(doc[key]);
				}
				var tmp = doc[key];
				if(typeof tmp == "object"){
					for(var key2 in tmp){
						if(key2.match(/_id/)){
							tmp[key2] = ObjectId(tmp[key2]);
						}
					}
				}
			}
		}
	}
	self.format = function(oriname, doc, flag){
		if(flag) name = oriname + "@"+flag;
		else name = oriname;
		if(!formatFuncs[name]) formatFuncs[name] = self.makeFormat(colDef[oriname], flag);
		if(isArray(doc)){
			for(var i=0;i<doc.length;i++){
				formatFuncs[name](doc[i]);
			}
		}else{
			formatFuncs[name](doc);
		}
	}
	self.getCol = function(name){
		var col = colCache[name];
		if(!col){
			col = conn.collection(name);
			colCache[name] = col;
		}
		return col;
	}
	self.connect = function(fn){
		mongodb.MongoClient.connect("mongodb://127.0.0.1:27017/main", function(err, client) {
			if(err) return fn(err);
      conn = client;
			eachSync(colArray, function(e, cb){
				var colConfig = colDef[e];
				if(colConfig.seed){
					self.getCol(e).findOne(function(err, result){
						if(err) return cb(err);
						if(!result){
							self.inserts(e, colConfig.seed, cb);
						}else{
							cb();
						}
					});
				}else{
					cb();
				}
			}, function(err){
			  fn(err, conn);
			});
		})
	}
	self.getCache = function(name, key, fn){
		if(!colDataCache[name]) colDataCache[name] = {};
		var cache = colDataCache[name];
		if(cache[key]) return fn(null, cache[key]);
		self.selectx(name, {$match: {_id: key}, $limit:1}, function(err, result){
			if(err) return fn(err);
			cache[key] = result[0];
			fn(null, result[0]);
		});
	}
	self.aggr = function(name, arr, fn){
		self.getCol(name).aggregate(arr, fn);
	}
	self.selectx = function(name, op, fn){
		var aggrarr = [];
		self.format(name, op.$match);
		if(op.$match) aggrarr.push({$match: op.$match});
    if(op.$sort && Object.keys(op.$sort).length>0)
      aggrarr.push({$sort: op.$sort});
    if(op.$skip)
      aggrarr.push({$skip: parseInt(op.$skip)});
    if(op.$limit)
      aggrarr.push({$limit: parseInt(op.$limit)});
    if(op.$project && Object.keys(op.$project).length>0)
      aggrarr.push({$project: op.$project});
		self.aggr(name, aggrarr, function(err, result){
			if(err) return fn(err);
			if(op.$join){
				if(op.$join.cache){
					var joinConfig = op.$join;
					eachSync(result, function(row, cb){
						self.getCache(joinConfig.schema, row[joinConfig.idField], function(err, result2){
							if(err) return cb(err);
							project(result2, joinConfig.project, row);
							cb();
						});
					}, function(err){
						if(err) return fn(err);
						fn(null, result);
					});
				}else if(op.$join.cacheAll){					
//TODO
				}else{
//TODO
				}
			}else{
				fn(null, result);
			}
		});
	},
	self.insert = function(name, doc, fn){
		self.format(name, doc, "insert");
		self.format(name, doc);
		self.getCol(name).insertOne(doc, function(err, result){
			var id = doc._id;
			delete doc._id;
			if(err) return fn(err);
			fn(null, {insertedId: id});
		});
	}
	self.inserts = function(name, docs, fn){
		self.format(name, docs, "insert");
		self.format(name, docs);
 		self.getCol(name).insertMany(docs, fn);
	}
	self.updatex = function(name, op, fn){
		self.format(name, op);
		var where = op.$match;
		self.format(name, where);
		delete op.$match;
		var method;
		if(op.$limit == 1)
			method = "updateOne"
		else
			method = "updateMany"
		delete op.$limit;
		self.getCol(name)[method](where, op, function(err, result){
      var rtn;
      if(result) rtn = result.result;
      else rtn = {n: 0};
      fn(err, rtn);
    });
	}
	self.upsertx = function(name, op, fn){
		self.format(name, op);
		var where = op.$match;
		self.format(name, where);
		delete op.$match;
		var method;
		if(op.$limit == 1)
			method = "updateOne"
		else
			method = "updateMany"
		delete op.$limit;
		self.getCol(name)[method](where, op, {upsert:true}, function(err, result){
      var rtn;
      if(result) rtn = result.result;
      else rtn = {n: 0};
      fn(err, rtn);
    });
	}
	self.sedatex = function(name, op, fn){
		self.format(name, op);
		var where = op.$match;
		self.format(name, where);
		delete op.$match;
		var method;
		if(op.$limit == 1)
			method = "updateOne"
		else
			method = "updateMany"
		delete op.$limit;
    self.getCol(name).findAndModify(where, [], op, function(err, doc){
      if(err) return fn(err);
      if(!doc) return fn(null, doc);
      fn(null, doc.value);
    });
	}
	self.count = function(name, op, fn){
		self.format(name, op);
    self.getCol(name).count(op, fn);
	}
	self.each = function(name, fn, fnfinal){
    var c = self.getCol(name).find();
    var nextFn = function(err, doc){
      if(err) return fnfinal(err);
      if(!doc) return fnfinal();
      fn(doc, function(err2){
        if(err2) return fnfinal(err2);
        c.next(nextFn);
      });
    };
    c.next(nextFn);
  }
	self.colectx = function(name, op, fn){
    self.format(name, op);
		self.count(name, op.$match, function(err, count){
      if(err) return fn(err);
      self.selectx(name, op, function(err, data){
        if(err) return fn(err);
        fn(err, {
          data: data,
          count: count
        });
      });
    });
	}
	self.drop = function(fn){
		conn.dropDatabase(fn);
	}
});;
module.exports.main = new Database();;
