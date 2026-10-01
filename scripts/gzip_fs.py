# Compresses the web files from data/ into .pio/data_gz/ before the LittleFS
# image is built. ESPAsyncWebServer serves "<file>.gz" automatically when
# "<file>" itself doesn't exist, so the sources in data/ stay readable.
import gzip
import os
import shutil

Import("env")

GZIP_EXT = (".html", ".js", ".css")

src_dir = env.subst("$PROJECT_DATA_DIR")
out_dir = os.path.join(env.subst("$PROJECT_DIR"), ".pio", "data_gz")

shutil.rmtree(out_dir, ignore_errors=True)
os.makedirs(out_dir)

for name in os.listdir(src_dir):
    src = os.path.join(src_dir, name)
    if not os.path.isfile(src):
        continue
    if name.endswith(GZIP_EXT):
        with open(src, "rb") as f_in, gzip.GzipFile(
            os.path.join(out_dir, name + ".gz"), "wb", 9, mtime=0
        ) as f_out:
            f_out.write(f_in.read())
    else:
        shutil.copy(src, out_dir)

env.Replace(PROJECT_DATA_DIR=out_dir)
