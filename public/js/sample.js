const sqlite = require('./sqlite');

// sqlite.getSV('chr02', 'DEL', 1000, 1100);
// sqlite.getSV('chr02', 'DEL', 0, 10000);

sqlite.openSVDB();
sqlite.getSV('chr01', 'DEL', 1000, 1100);
sqlite.closeSVDB();

// var stringSQL = 'punyeta';