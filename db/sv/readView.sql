DROP TABLE if exists deletions;
CREATE TABLE if not exists deletions(
	"chr" TEXT,
	"start" INTEGER,
	"end" INTEGER,
	"clusterid" INTEGER
);

.separator "\t"
.import ./sv/raw/NB_DEL_mergesam_hclust.bed deletions

DROP TABLE if exists inversions;
CREATE TABLE if not exists inversions(
	"chr" TEXT,
	"start" INTEGER,
	"end" INTEGER,
	"clusterid" INTEGER
);

.separator "\t"
.import ./sv/raw/NB_INV_mergesam_hclust.bed inversions

DROP TABLE if exists duplications;
CREATE TABLE if not exists duplications(
	"chr" TEXT,
	"start" INTEGER,
	"end" INTEGER,
	"clusterid" INTEGER
);

.separator "\t"
.import ./sv/raw/NB_DUP_mergesam_hclust.bed duplications

DROP TABLE if exists insertions;
CREATE TABLE if not exists insertions(
	"chr" TEXT,
	"start" INTEGER,
	"end" INTEGER,
	"clusterid" INTEGER
);

.separator "\t"
.import ./sv/raw/NB_INS_mergesam_hclust.bed insertions
