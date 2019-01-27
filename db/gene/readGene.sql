DROP TABLE if exists genes;
CREATE TABLE if not exists genes(
	"seqid" TEXT, 
	"source" TEXT,
	"type" TEXT,
	"start" INTEGER,
	"end" INTEGER,
	"score" TEXT,
	"strand" TEXT,
	"phase" TEXT,
	"attributes" TEXT
);

.separator "\t"
.import ./gene/raw/all_intron.gff3 genes
