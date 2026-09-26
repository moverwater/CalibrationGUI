# Calibration GUI

This is an GUI for specifying node calibrations for molecular clock dating analyses. You can load an alignment file (NEXUS, PHYLIP, FASTA), a BEAST XML, or a Newick tree and define calibrations with min/max age bounds and calibration densities. The outputs are:
 - A constraint tree in Newick or NEXUS format.
 - A BEAST3 XML snippet for inputting the calibrations into a `CalibratedCPP` tree prior, a joint `CalibrationPrior` over all calibration nodes based on min/max age information, independent `MRCAPriors` on each node.
 - A LinguaPhylo script snippet for the defined calibrations.
