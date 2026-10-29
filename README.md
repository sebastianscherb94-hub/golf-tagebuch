# Golf-Tagebuch

Eine einfache Golf-App für das iPhone, als Web-App, die offline funktioniert. Alle Daten bleiben auf dem Handy.

## Funktionen
- **Plätze** anlegen: Name, 9 oder 18 Löcher, Par und Länge pro Loch
- **Runde mitschreiben**: pro Loch Abschlag-Schläger, Weite, Schläge, Putts und Wind (Stärke und Richtung)
- **„Letztes Mal hier“**: zeigt an jedem Loch Schläger, Weite, Schläge und Wind vom letzten Mal
- **Tipp pro Loch**: eine Notiz, die dauerhaft beim Loch gespeichert bleibt
- **Wetter automatisch** zu Beginn der Runde (Open-Meteo, kostenlos, braucht Standort und Internet)
- **Schläger**: Durchschnittsweite pro Schläger, Vorschlag bei Par-3-Löchern
- **Sichern / Wiederherstellen** als Datei (iCloud Drive / Dateien), mit Erinnerung nach 30 Tagen

## Dateien
- `index.html`, `styles.css`, `app.js`: die App
- `sw.js`: Offline-Modus. **Nach jeder Änderung `CACHE` hochzählen** (`golf-tagebuch-v2` …), sonst behält das iPhone die alte Version.
- `manifest.webmanifest`, `icons/`: App-Name und App-Symbol

## Auf das iPhone bringen
1. Den Ordner bei einem HTTPS-Hoster veröffentlichen (z. B. GitHub Pages oder Netlify). HTTPS ist nötig, sonst funktionieren Standort und Offline-Modus nicht.
2. Die Adresse auf dem iPhone in **Safari** öffnen.
3. **Teilen** → **„Zum Home-Bildschirm“**.
4. Die App einmal mit Internet öffnen, danach funktioniert sie auch offline.

Wichtig: Wird das App-Symbol gelöscht, sind auch die Daten weg. Deshalb regelmäßig über „Sichern“ eine Sicherung machen.
