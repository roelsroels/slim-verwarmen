# Slim verwarmen

Een statische, eenvoudige webtool die de verwarmingskosten vergelijkt van:

- een configureerbare airco/warmtepomp;
- een configureerbare cv-ketel;
- de ruimte die je zelf opgeeft.

De pagina haalt de `all_in_with_vat`-prijsreeks op via de publieke EnergyZero API en de buitentemperatuur plus verwachting via Open-Meteo. Ruimte, locatie, voorkeurstemperatuur, brongegevens, vermogen, correcties, rendement en warmteverlies zijn instelbaar. Alle instellingen blijven alleen in de lokale browseropslag; er wordt geen Home Assistant-token gebruikt of opgeslagen.

Je kunt één of twee warmtebronnen actief maken. Met twee bronnen toont de tool de kostenvergelijking en mogelijke schakelmomenten. Met één bron verdwijnen de niet-relevante vergelijking en het omslagpunt, zodat alleen het kostenprofiel, de capaciteit en planning van die bron overblijven. De tool voorkomt dat beide bronnen tegelijk worden uitgezet.

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
- Cv-ketel: `gasprijs / (energie-inhoud gas × ketelrendement)`
- Warmtevraag: ingesteld oppervlak × warmteverlies, geschaald met het actuele temperatuurverschil, plus een tijdelijke opwarmcomponent.

De uitkomst is indicatief en geen energielabel- of installateursberekening.
