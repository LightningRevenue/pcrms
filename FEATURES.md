# CRM — Prezentare Funcționalități Comerciale

Document de referință cu tot ce oferă aplicația din perspectivă de business. Funcționalitățile marcate **(Coming soon)** sunt vizibile în meniu dar nu sunt încă implementate — incluse aici ca roadmap, nu ca livrate.

---

## 1. Gestionare Contacte & Companii

- **Companii** și **Persoane (Contacte)** ca înregistrări principale, fiecare cu pagină de detaliu: navigare prev/next prin lista curentă, favorite (marcare cu stea, max. 5 per utilizator pentru acces rapid din sidebar).
- **Auto-legare contact → companie**: la crearea unui contact cu adresă de email, se deduce automat numele companiei din domeniu (ex: `jane@acme.com` → "Acme") și se atașează la o companie existentă sau se creează una nouă — fără introducere manuală.
- **Editare inline a câmpurilor** cu istoric complet: fiecare modificare (nume, telefon, funcție, LinkedIn, owner, companie, câmpuri custom) e înregistrată într-un **jurnal de activitate (Activity timeline)** pe fișa înregistrării — cine, ce, valoare înainte/după.
- **Atribuire (ownership)**: contactele și deal-urile pot fi asignate unui membru al echipei (individual sau în masă); determină ce vede un rol "Member" (vezi Permisiuni mai jos).
- **Câmpuri custom**: adminii pot adăuga câmpuri proprii pe Companii și Persoane (Text, Număr, Dată, sau Select cu opțiuni custom), reordonabile — apar automat în fișe, în maparea de import CSV, și ca token-uri de mail-merge.
- **Notițe**: text liber atașat unui contact, care poate fi legat de unul sau mai multe deal-uri.
- **Task-uri**: to-do-uri atașate unui contact (apel, email, eveniment, întâlnire, general), cu dată scadentă și prioritate (mică/medie/mare), pot fi legate de deal-uri; indicator "următorul task" în listă; view de Calendar și widget "task-uri scadente azi" pe Home.
- **Ștergere reversibilă (Trash)**: ștergerea unei companii/contact/deal nu e definitivă — merge în Trash 30 de zile (restaurabilă de owner/admin) înainte de purjare automată nocturnă. O companie/contact nu poate fi ștearsă cât timp are contacte/deal-uri legate (previne date orfane).
- **Import CSV**: import în masă de Companii sau Persoane, cu UI de mapare a coloanelor (auto-sugestii, inclusiv pe câmpuri custom), preview al primelor rânduri, și procesare în fundal pentru fișiere mari; istoricul importurilor arată status și erori per rând.
- **Căutare globală & scoped**: căutare pe tot workspace-ul, plus câmpuri de căutare rapidă folosite peste tot (alegere destinatari campanie, contacte pentru secvențe, adăugare într-o listă).
- **Liste**: liste statice definite de utilizator (companii, persoane sau deal-uri — un singur tip de entitate per listă) pentru segmentare ad-hoc, independent de etapa de pipeline sau apartenența la campanie.

## 2. Pipeline de Vânzări (Deals / Opportunities)

- **Deal-uri ("Opportunities")** cu nume, valoare, etapă de pipeline și dată de închidere, legate de o companie și un contact principal.
- **Conversie Contact → Deal** direct din fișa contactului (precompletează compania/contactul).
- **Etape de pipeline configurabile** (Settings → Pipeline): adminii definesc etapele prin care trec deal-urile și marchează fiecare etapă ca Open, Won sau Lost — mutarea într-o etapă Won/Lost setează automat data de închidere.
- **Ownership deal cu istoric complet** (schimbări de etapă, schimbări de owner) — logat pe deal și oglindit pe contactul/compania legate, pentru istoric complet vizibil din oricare din cele trei fișe.
- Deal-urile agregă **email-uri, task-uri și notițe** legate.
- **Dashboard Home**: lead-uri noi azi, contactați azi, deal-uri câștigate săptămâna asta, valoare pipeline deschis — plus grafic trend 7 zile și feed de activitate recentă.
- **Sales Tracking dashboard**: statistici pe interval (azi/săptămână/lună) cu variație % față de perioada anterioară pentru open-uri email (total/unice), contacte create, email-uri trimise, răspunsuri; trend 14 zile; breakdown "ownership pe rep" — vizibilitate de manager asupra volumului fiecărui membru.

## 3. Inbox Unificat & Email

- **Două moduri de trimitere/primire**: (1) Gmail personal conectat (OAuth), sau (2) unul sau mai multe "Outreach Inboxes" conectate prin SMTP/IMAP brut — util pentru trimitere din alte adrese decât Gmail-ul personal al unui rep.
- **Inbox Unificat**: unește email-urile din Gmail și din mailbox-urile SMTP/IMAP într-un singur fir de conversație (Gmail nativ; SMTP/IMAP prin urmărirea lanțului Reply-To) — o conversație citește ca un singur thread indiferent de mailbox.
- **Sincronizare manuală** IMAP la cerere, pe lângă polling-ul automat.
- **Sincronizare automată în fundal**: răspunsurile Gmail sunt verificate la ~2 minute; mailbox-urile IMAP sunt verificate periodic (ultimele 24h), limitat la contacte cunoscute în CRM (traficul de "warmup" pe outreach inboxes nu intră ca zgomot).
- **Notificări de răspuns**: la un reply, repul asignat primește notificare in-app (live) și pe email, cu link direct la mesaj.
- **Tracking de deschidere email**: fiecare email trimis include un pixel invizibil de tracking; deschiderile sunt logate (timestamp, IP, user agent) și agregate în rate de deschidere pe fișe, campanii și dashboard-uri.
- **Mail merge / personalizare**: token-uri `{{person.firstName}}`, `{{company.name}}`, câmpuri custom etc. — populate automat la trimitere pentru email-uri individuale, pași de secvență și campanii; preview live cu date reale înainte de trimitere.
- **Template-uri de email**: reutilizabile (gestionate de admin), folosite în trimiteri individuale, secvențe și campanii.
- **BCC automat pe Gmail-ul personal**: când un rep trimite printr-un outreach inbox partajat, Gmail-ul lui personal primește BCC ca să păstreze vizibilitate — răspunsurile ajung tot doar la outreach inbox.
- **Blocklist**: excluderea unor persoane/domenii din sincronizarea Gmail, ca thread-urile interne/irelevante să nu intre în CRM.
- **Domeniu custom de tracking**: adminii pot folosi un subdomeniu propriu pentru link-urile de tracking (în loc de cel implicit) — ghid pas-cu-pas inclus în settings (EC2 + reverse proxy + DNS).

## 4. Secvențe de Outreach (Drip Campaigns Automatizate)

- **Secvențe multi-pas** per contact: fiecare pas poate fi **email** (custom sau pe bază de template), **task** (creat automat pentru rep, ex: "sună acest lead"), sau **notiță** — combină atingeri automate cu memento-uri manuale într-un singur flux.
- **Delay configurabil per pas**: fiecare pas se declanșează la un număr de zile/ore de la înrolare (cumulativ de la start, nu de la pasul anterior) — ex: Ziua 0 email, Ziua 3 task, Ziua 7 email.
- **Reordonare prin drag**, adăugare/ștergere pași liber, activare/dezactivare secvență fără ștergere.
- **Înrolare unul sau mai mulți contacți** deodată, cu picker de căutare care arată cine e deja înrolat; un contact nu poate fi înrolat de două ori în aceeași secvență.
- **Un contact poate fi într-un singur flux automat activ**: înrolarea într-o Secvență blochează adăugarea într-o Campanie în masă (și invers) cât timp una din ele e activă — previne trimiterea a două email-uri automate conflictuale către același lead.
- **Runner în fundal**: job programat (la 5 minute) trimite email-urile scadente și creează task-urile/notițele scadente automat; progresul fiecărui contact (activ/complet/anulat) și statusul fiecărui pas (pending/trimis/eșuat/omis) sunt urmărite.
- **Anulare înrolare** oricând (ex: lead-ul a răspuns și nu mai are nevoie de follow-up automat); pașii în desfășurare sunt marcați ca omiși.
- Email-urile de secvență folosesc Gmail-ul conectat al repului (nu un inbox partajat), personalizate prin token-uri, cu același pixel de tracking ca trimiterile manuale.

## 5. Email Marketing & Campanii

- **Campanii de email în masă**: trimitere unică către o listă statică de destinatari (spre deosebire de drip-ul continuu al Secvențelor) — destinatari aleși direct din Contacte sau prin contactele atașate unor Deal-uri specifice.
- **Trimitere round-robin pe mai multe mailbox-uri**: selectezi mai multe outreach inboxes pentru o campanie; trimiterile sunt distribuite round-robin între ele — reduce riscul ca un singur mailbox să fie marcat spam.
- **Pacing randomizat**: fiecare trimitere e pusă în coadă cu un interval randomizat de 30–60 secunde față de precedenta, ca tot lotul să iasă treptat, ca un trimițător uman, nu ca un bulk blast detectabil.
- **Verificări de pregătire** înainte de lansare: campania nu pornește fără cel puțin un destinatar, un outreach inbox selectat și un template de email ales — cu mesaj clar despre ce lipsește.
- **Dashboard live de progres** per campanie: număr de pending/queued/trimise/eșuate/deschise, cu tabel per destinatar (status, timestamp trimitere, eroare dacă a eșuat, dacă/când a deschis).
- **Preview de template cu date reale** înainte de trimitere.
- **Zonă Marketing restricționată pe rol**: doar owner/admin au acces la Marketing (campanii, dashboard marketing, testare inbox placement) — reps obișnuiți nu văd secțiunea.
- **Marketing Dashboard** și **Inbox Placement Testing** — **(Coming soon)**, vizibile în navigare dar neconstruite încă.

## 6. Automatizare Workflow-uri **(early stage)**

- **Workflow builder**: creare workflow numit cu alegerea unui trigger — record creat, actualizat, șters, creat-sau-actualizat, manual, programat, sau webhook.
- **Acțiunile/pașii nu sunt încă implementați** — builder-ul suportă momentan doar denumirea workflow-ului și alegerea trigger-ului; nu există încă înlănțuire de acțiuni. Fundație pentru reguli de automatizare, nu funcționalitate completă.
- Lista de workflow-uri arată status draft/activ, creator, dată — acces restricționat la owner/admin.

## 7. Apelare / Twilio Voice

- **Click-to-call din fișa contactului**: apel outbound direct din browser (WebRTC prin Twilio Voice SDK) — fără telefon separat sau softphone.
- **Înregistrare automată a apelurilor**: fiecare apel e înregistrat din momentul răspunsului; înregistrarea e preluată și stocată (URL semnat/streamed) după ce Twilio termină procesarea.
- **Istoric de apeluri per contact**: fiecare încercare e logată (status: inițiat/sună/în desfășurare/complet/eșuat/fără răspuns/ocupat, ora start/end, durată, și — odată disponibilă — o înregistrare redabilă), atribuită repului care a sunat.
- **Configurare Twilio la nivel de workspace** (Settings → Accounts → Twilio, doar owner): conectare cont Twilio (Account SID, Auth Token, număr de telefon pentru caller ID) plus credențiale API Key/TwiML App — stocate criptat în bază, rotabile fără redeploy.
- Momentan **doar apeluri outbound** — apelurile inbound nu sunt gestionate.

## 8. Playbooks (Conținut de Enablement pentru Vânzări)

- **Playbooks**: documente structurate scrise de admin, din secțiuni ordonate (titlu + conținut rich per secțiune) — folosite pentru scripturi de onboarding, ghiduri de gestionare a obiecțiilor, sau documentație de proces pentru echipa de vânzări. Gestionate din Settings → Playbook Templates.

## 9. Calendar & Task Management

- **View de Calendar**: toate task-urile cu dată scadentă, plotate pe calendar.
- **Listă de task-uri & widget "scadente azi"**: pe dashboard-ul Home, pentru vizibilitate imediată.
- **Conectare Google Calendar**: vizibilă în Settings (Accounts → Calendars), arată status conectat/sincronizat.

## 10. Setări & Administrare

### Echipă & workspace
- **Members**: invitare colegi pe email (doar owner) — primesc link de autentificare unic și ajung direct în workspace; invitația expiră după 7 zile; invitațiile în așteptare pot fi revocate.
- **Roluri pe două niveluri**: **Owner** (acces complet, inclusiv billing/membri/Twilio/setup mailbox), **Admin** (poate gestiona modelul de date, etapele de pipeline, playbooks, template-uri email, import, trash — dar nu billing/membri/credențiale de integrare), **Member** (uz zilnic CRM).
- **Vizibilitate la nivel de rând pentru Member**: un "member" vede doar contactele și deal-urile pe care le deține; vede o companie doar dacă deține cel puțin un contact/deal legat de ea. Owner/Admin văd tot workspace-ul. Permite unui manager să vadă tot pipeline-ul echipei, în timp ce fiecare rep vede doar propriul portofoliu.
- **Un workspace per domeniu de email**: primul care se autentifică de pe un domeniu (ex: `acme.com`) creează și deține automat acel workspace; oricine altcineva de pe domeniu trebuie invitat explicit — nu se poate alătura doar pentru că are același domeniu. Domeniile personale (Gmail etc.) nu pot crea workspace, prevenind workspace-uri fantomă.
- **Flux de onboarding**: primul owner setează numele workspace-ului/industria/mărimea companiei; primii membri își completează numele/funcția.

### Date & personalizare
- **Data Model**: vizualizare/gestionare câmpuri custom pe Companii și Persoane (adăugare/ștergere, contorul de câmpuri & înregistrări); diagramă vizuală a modelului de date.
- **Etape de pipeline**: definire/reordonare etape, marcare Open/Won/Lost.
- **Import**: intrare CSV (Companii/Persoane) cu maparea/preview descrise mai sus.
- **Trash**: vizualizare/restaurare/purjare definitivă a elementelor șterse (doar owner/admin); purjare automată după 30 de zile.

### Email & tracking
- **Email Templates**: creare/editare/ștergere template-uri reutilizabile.
- **Email Tracking**: configurare URL de bază și domeniu custom opțional pentru pixelul de tracking, cu ghid tehnic încorporat.
- **Email Notifications**: alegerea outreach inbox-ului din care pleacă notificările interne (ex: "ți-a fost asignat un lead"), la nivel de workspace (doar owner).
- **General (per utilizator)**: alegerea mailbox-urilor conectate ale workspace-ului care sunt "ale tale" implicit pentru trimitere.

### Conturi / integrări
- **Emails** (Google OAuth): conectare/gestionare cont Gmail pentru trimitere/primire și sincronizare personală; blocklist per utilizator.
- **Calendars** (Google OAuth): conectare/status sincronizare Google Calendar.
- **Outreach Inboxes**: conectare mailbox-uri suplimentare prin SMTP/IMAP brut (fără OAuth) — suportă **import CSV în masă** de credențiale mailbox (format "maildoso", tool comun de provisioning pentru cold-email), și **verificare de sănătate a conexiunii** cu un click (testează atât trimiterea SMTP cât și login-ul IMAP, arătând status per mailbox și eroarea de conexiune dacă există).
- **Twilio**: conectare credențiale de apelare (vezi secțiunea Apelare).

### Operațional / job-uri în fundal
- **Panou Cron Jobs** (doar owner): vizibilitate pe trei job-uri programate — `gmail-reply-sync` (verifică thread-uri Gmail pentru răspunsuri noi la 2 min), `sequence-step-runner` (trimite email-uri de secvență scadente / creează task-uri-notițe la 5 min), și `trash-purge` (șterge definitiv înregistrările din Trash de peste 30 zile, zilnic) — fiecare cu istoric de rulare (succes/eroare, timestamp, câte elemente procesate) și buton "run now".
- **Admin console** (`/admin`, separat de Settings): zonă doar pentru operatorul platformei (flag special de "platform admin" pe utilizator, nu rol de workspace) — listă a tuturor workspace-urilor de pe platformă, membri și numărul de înregistrări per workspace, **suspendare/reactivare workspace** (suspendarea blochează imediat toate sesiunile active ale acelui workspace, nu doar login-urile viitoare).
- **Queue monitor** (`/admin/queues`, doar platform-admin): vizualizare cozi de job-uri în fundal (număr de job-uri pe waiting/active/completed/failed/delayed), inspectare payload/motiv eșec per job, retry sau ștergere job eșuat — tool operațional pentru diagnosticarea importurilor/campaniilor blocate.

### Pagini stub / **(Coming soon)**
Vizibile în navigare, neconstruite încă — de tratat ca roadmap, nu ca funcționalități livrate: **Billing**, **AI**, **Apps**, **MCP & APIs**, **Experience** (preferințe utilizator), **Community**, **Support**, **Documentation**, **Marketing Dashboard**, **Inbox Placement Testing**.

## 11. Securitate & Încredere

- Parolele mailbox-urilor de outreach și token-urile Twilio sunt stocate **criptate în bază de date** (nu în clar), decriptate doar în momentul folosirii (trimitere email / apel).
- Fiecare modificare relevantă a unei înregistrări (editări de câmp, schimbări de owner, mutări de etapă, ștergeri) e capturată într-un **jurnal de activitate imuabil** legat de utilizatorul care a acționat — istoric complet auditabil per înregistrare.
- Suspendarea unui workspace (acțiune de platform-admin) are efect **imediat** asupra tuturor sesiunilor active, nu doar la următorul login.

---

*Document generat pentru prezentare comercială — reflectă starea codului la 2026-07-21. Funcționalitățile "Coming soon" sunt incluse ca roadmap vizibil în UI, nu ca livrate.*
