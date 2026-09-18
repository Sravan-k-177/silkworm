# Media test fixtures

`capture-test.webm` is a synthetic FFmpeg test-pattern clip, 320×240, 10 fps, two seconds, VP9. It is used only to verify decoding, temporal sampling and offline media persistence. It is not silkworm research data and is never used for model training or accuracy claims.

Recreate at a new output path with:

```bash
ffmpeg -f lavfi -i testsrc2=size=320x240:rate=10 -t 2 -c:v libvpx-vp9 -an capture-test.webm
```

`mulberry-rust.png` is the first Leaf rust entry in the existing internal test split manifest, copied without further transformation. Provenance is in `mulberry-rust.provenance.json`; original dataset: nahiduzzaman13/mulberry-leaf-dataset, CC0. It exercises the positive leaf-review workflow and is not independent field validation. No training or threshold tuning was performed with this fixture.
