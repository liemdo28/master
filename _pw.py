import pathlib
p = pathlib.Path(r"e:\Project\Master\mi-core\EXECUTIVE_REFLECTION_ENGINE.md")
p.write_text(open(r"_pw_src.txt","r",encoding="utf-8").read(), encoding="utf-8")
print("Done")
