# Calibration GUI

This is an GUI for specifying node calibrations for molecular clock dating analyses. You can load an alignment file (NEXUS, PHYLIP, FASTA), a BEAST XML, or a Newick tree and define calibrations with min/max age bounds and calibration densities. The outputs are:
 - A constraint tree in Newick or NEXUS format.
 - A BEAST3 XML snippet for inputting the calibrations into a `CalibratedCPP` tree prior, a joint `CalibrationPrior` over all calibration nodes based on min/max age information, independent `MRCAPriors` on each node.
 - A LinguaPhylo script snippet for the defined calibrations.

## Running locally

The app is built from ES modules, which browsers will not load from a page opened as a local
file. Serve the folder instead:

```bash
python3 -m http.server 8000
```

and open <http://localhost:8000/>. (`npm start` runs the same command.) Nothing is uploaded:
files are read in the browser, and the session is saved in the browser's local storage.

## Tests

```bash
npm test
```

runs Node's built-in test runner (Node 18+, no dependencies). `test/golden.test.js` replays the
scenarios in `test/scenarios.js` (the examples, hand-made groups, every distribution type,
warning cases and each input format) and compares every export, for every option combination,
with `test/fixtures/golden.json.gz`. The fixture was recorded from the original single-file
version of the app, so a failure means an output changed. If a change is intended, re-record the
fixture and review the diff.

## Layout

```
index.html              markup
css/style.css
js/main.js              entry point: wires the panels together
js/store.js             app state, undo/redo, saving in the browser
js/model.js             taxa, groups and calibrations; the clade tree; warnings   (no DOM)
js/parse.js             FASTA, NEXUS, PHYLIP, Newick and BEAST XML readers           (no DOM*)
js/distributions.js     MRCA-prior distributions, densities and plots               (no DOM)
js/export/              Newick/NEXUS, BEAST 3 XML and LinguaPhylo exporters          (no DOM)
js/ui/                  the panels: taxa, tree, groups, export, layout, loading, keyboard
js/examples.js          the Examples menu, loading files from examples/
examples/               example datasets
test/                   regression tests
```

\* Reading BEAST XML uses the browser's `DOMParser`; everything else in the non-UI modules runs in Node.
