var reader = require('fastareader').create('./db/ref/IRGSP-1.0_genome.fa');

module.exports.getSubstring = function(rname, start, length, rev, callback){
	var seq = reader.fetch(rname, start, length, rev);
	callback(seq);
}

module.exports.getChrLength = function(rname, callback){
	var length;
	try{
		length = reader.getEndPos(rname);
	}
	catch(err){
		// gets an error if the chr does not exists in the FASTA file
		length = 0;
	}
	callback([length]);
}
