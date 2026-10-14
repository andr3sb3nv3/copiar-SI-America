"""Bundle the built pages into HTML files that can be opened without a server."""

from pathlib import Path
import base64
import json
import re
import zipfile

project = Path(__file__).resolve().parent.parent
output = project.parent / "si-america-safari"
output.mkdir(exist_ok=True)


def data_url(path):
    mime = {
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
    }[path.suffix]
    return "data:" + mime + ";base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def page_css(source):
    built = (project / "dist" / source).read_text()
    styles = re.findall(r'<link[^>]+href="([^"\s]+\.css)"', built)
    if not styles:
        raise RuntimeError("No compiled stylesheet found for " + source)
    css = "\n".join((project / "dist" / path.lstrip("/")).read_text() for path in styles)
    return re.sub(
        r"url\((/assets/[^)]+)\)",
        lambda match: "url(" + data_url(project / "dist" / match.group(1).lstrip("/")) + ")",
        css,
    )


def page_script(name):
    script = (project / "src" / name).read_text()
    script = script.replace('s.crossOrigin = "anonymous"', 's.crossOrigin = null')
    script = re.sub(
        r'''(["'])/images/([^"']+)\1''',
        lambda match: json.dumps(data_url(project / "public/images" / match.group(2))),
        script,
    )
    if name == "site.js":
        for source, target in [
            ('"": "/",', '"": "index.html",'),
            ('education: "/initiatives/education",', 'education: "education.html",'),
            ('challenge: "/initiatives/presidential-challenge",', 'challenge: "presidential-challenge.html",'),
            ('benve: "/benve",', 'benve: "benve.html",'),
            ('atenea: "/atenea",', 'atenea: "atenea.html",'),
        ]:
            if source not in script:
                raise RuntimeError("Navigation declaration missing: " + source)
            script = script.replace(source, target)
        normalizer = '_ = (t) => t.replace(/\\/+$/, "") || "/",'
        if normalizer not in script:
            raise RuntimeError("The site route normalizer changed")
        script = script.replace(
            normalizer,
            '_ = (t) => decodeURIComponent(t).split("/").filter(Boolean).pop() || "index.html",',
        )
    return script.replace("</script", "<\\/script")


pages = {
    "index.html": ("index.html", "site.js"),
    "education.html": ("initiatives/education/index.html", "site.js"),
    "presidential-challenge.html": ("initiatives/presidential-challenge/index.html", "site.js"),
    "benve.html": ("benve/index.html", "benve.js"),
    "atenea.html": ("atenea/index.html", "atenea.js"),
}
routes = {
    "/": "index.html",
    "/benve": "benve.html",
    "/benve/": "benve.html",
    "/atenea": "atenea.html",
    "/atenea/": "atenea.html",
    "/initiatives/education": "education.html",
    "/initiatives/education/": "education.html",
    "/initiatives/presidential-challenge": "presidential-challenge.html",
    "/initiatives/presidential-challenge/": "presidential-challenge.html",
}

for filename, (source, script_name) in pages.items():
    html = (project / source).read_text()
    html, style_count = re.subn(
        r'<link\b[^>]*href="/src/[^"\s]+\.css"[^>]*/?>',
        lambda _: "<style>" + page_css(source) + "</style>",
        html,
    )
    html = re.sub(
        r'(src|href)="(/(?:images/[^"\s]+|favicon\.png))"',
        lambda match: match.group(1) + '="' + data_url(project / "public" / match.group(2).lstrip("/")) + '"',
        html,
    )
    html = html.replace('crossorigin="anonymous"', "")
    for path, destination in routes.items():
        html = html.replace('href="' + path + '"', 'href="' + destination + '"')
    html, script_count = re.subn(
        r'<script\b[^>]*src="/src/[^"\s]+\.js"[^>]*>\s*</script>',
        lambda _: "<script>" + page_script(script_name) + "</script>",
        html,
    )
    if style_count != 1 or script_count != 1 or 'src="/src/' in html or 'href="/src/' in html:
        raise RuntimeError("Incomplete standalone page: " + filename)
    (output / filename).write_text(html)

(output / "ABRIR-EN-SAFARI.txt").write_text(
    "1. Descomprime si-america-safari.zip.\n"
    "2. Abre benve.html con Safari para ver BENVE sobre fondo azul.\n"
    "3. Abre index.html para ver la replica de SI.gov.\n"
    "4. Baja por la pagina: el logo gira y se transforma en BENVE y luego en dos vestidos.\n"
    "5. Move el mouse sobre los puntos y hace clic para crear ondas.\n\n"
    "6. Abre atenea.html para ver el logo de ATENEA en puntos verdes sobre azul oscuro.\n\n"
    "No necesitas instalar Node ni iniciar un servidor. Conserva los cinco archivos HTML juntos para navegar entre las paginas.\n"
)
archive = output.with_suffix(".zip")
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
    for filename in [*pages, "ABRIR-EN-SAFARI.txt"]:
        bundle.write(output / filename, output.name + "/" + filename)
print("Exported:", archive)
print("Open:", output / "benve.html")
