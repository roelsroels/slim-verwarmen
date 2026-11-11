# Slim verwarmen

Een statische, private webtool die de verwarmingskosten vergelijkt van:

- Mitsubishi Heavy Industries SCM40ZS-W / SRK35ZS-W warmtepomp;
- Intergas 28/24A cv-ketel;
- de woonkamer van circa 60 m².

De pagina haalt de `all_in_with_vat`-prijsreeks op via de publieke EnergyZero API en de buitentemperatuur plus verwachting via Open-Meteo. Correcties, rendement en warmteverlies zijn instelbaar. Alle instellingen blijven alleen in de lokale browseropslag; er wordt geen Home Assistant-token gebruikt of opgeslagen.

De 48-uursplanner vergelijkt per uur de kosten van airco, gas en — bij een hogere warmtevraag — hybride verwarmen. Verwachte schakelmomenten worden boven de tijdlijn en in een compacte lijst getoond. Wanneer toekomstige prijzen nog niet gepubliceerd zijn, wordt de planning beperkt tot de beschikbare periode.

## Lokaal openen

Serveer de map `dist/` met een eenvoudige statische webserver. Rechtstreeks openen als `file://` werkt voor de calculator, maar browsers kunnen dan externe API-aanvragen blokkeren.

## Docker

```bash
docker compose up -d --build
```

Open daarna `http://<docker-host>:5080`. De container gebruikt Nginx, draait met een read-only bestandssysteem en heeft een ingebouwde healthcheck. Nginx proxy't alleen de publieke EnergyZero-prijsaanvraag via hetzelfde origin, zodat browsers deze niet door CORS blokkeren.

Stoppen:

```bash
docker compose down
```

## GitHub Pages

De openbare Pages-versie staat op `https://roelsroels.github.io/slim-verwarmen/`. De workflow in `.github/workflows/github-pages.yml` publiceert `dist/` na iedere wijziging en vernieuwt iedere 15 minuten statische prijs-snapshots van EnergyZero. Daardoor heeft de Pages-versie geen serverproxy of toegangssleutel nodig.

## Rekenmethode

- Warmtepomp: `elektriciteitsprijs / geschatte COP`
- Cv-ketel: `gasprijs / (9,77 kWh/m³ × ketelrendement)`
- Warmtevraag: 60 m² × warmteverlies, geschaald met het actuele temperatuurverschil, plus een tijdelijke opwarmcomponent.

De uitkomst is indicatief en geen energielabel- of installateursberekening.
