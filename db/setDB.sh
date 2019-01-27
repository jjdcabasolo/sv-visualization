#!/bin/bash

echo "Processing sv-table file... Please wait."
sqlite3 ./sv/processed/sv.db ".read sv/readSV.sql"
echo "Finished."

echo "Processing sv-view file... Please wait."
sqlite3 ./sv/processed/view.db ".read sv/readView.sql"
echo "Finished."

echo "Processing gene-annotation file... Please wait."
sqlite3 ./gene/processed/gene.db ".read gene/readGene.sql"
echo "Finished."