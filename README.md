# Slim verwarmen

Een statische, private webtool die de verwarmingskosten vergelijkt van:

- Mitsubishi Heavy Industries SCM40ZS-W / SRK35ZS-W warmtepomp;
- Intergas 28/24A cv-ketel;
- de woonkamer van circa 60 m².

De pagina probeert actuele marktprijzen op te halen via de publieke EnergyZero API en de buitentemperatuur via Open-Meteo. Opslagen, rendement en warmteverlies zijn instelbaar. Alle instellingen blijven alleen in de lokale browseropslag; er wordt geen Home Assistant-token gebruikt of opgeslagen.

## Lokaal openen

Serveer de map `dist/` met een eenvoudige statische webserver. Rechtstreeks openen als `file://` werkt voor de calculator, maar browsers kunnen dan externe API-aanvragen blokkeren.

## Rekenmethode

- Warmtepomp: `elektriciteitsprijs / geschatte COP`
- Cv-ketel: `gasprijs / (9,77 kWh/m³ × ketelrendement)`
- Warmtevraag: 60 m² × warmteverlies, geschaald met het actuele temperatuurverschil, plus een tijdelijke opwarmcomponent.

De uitkomst is indicatief en geen energielabel- of installateursberekening.
