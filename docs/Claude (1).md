# Smart Attendance System ~~—~~ Technical Specificationeu . v8 (BuilP ~~d-~~ Ready) 

Purpose of this document: Complete build specification for a multi ~~-~~ tenant, automated classroom attendance system. Version 8 adds a "permitted exit" mechanism: when a student genuinely needs to step out mid ~~-c~~ lass (emergency, family matter, etc.) and informs the teacher, the teacher can mark it with one tap so the system never flags that window as a suspected proxy exit. Hand this document to an Al coding assistant (Claude Code, Cursor, etc.) and build phase by phase ~~—~~ do not implement everything in one 

pass. 

## 1. Product Summary 

A mult ~~i-~~ tenant SaaS platform that automates classroom attendance using face recognition, eliminating proxy attendance without requiring manual effort from teachers. One codebase serves unlimited institutions, each fully data ~~-i~~ solated. Performance stays linear regardless of institution size. 

###### Non ~~-n~~ egotiable qualities: 

Zero routine teacher interaction during class (the teacher may still need to intervene on genuine system issues ~~—~~ see Section 8) 

No single point of failure ~~—~~ a camera outage or one failed face match never crashes a session or silently loses data 

Linear performance regardless of institution size (matching is always scoped to a single class roster, never the whole institution) 

Every automated decision is reversible and auditable 

Mental model (this is the key shift from v1): the system does not go straight from "face recognition” to "attendance." It goes: 



Treating raw detections as evidence, not as the final answer, is what makes the rest of this document 

work. As of v6, the system also does not assume every enrolled student needs to be watched for ~~—~~ it only continuously monitors students the college's existing entry ~~-~~ scan device (referred to below as the 

"external check ~~-i~~ n system") has already confirmed as present for that session. This keeps the product from duplicating hardware/verification the institution has already paid for, and shrinks the matching workload to a smaller, more accurate candidate pool per session. 

Why 

#### 2. Tech Stack 

###### Layer Choice 

Frontend Next.js ((AppPP Router)) + Type safety, SSR for dashboard TypeScript Hosting Vercel Matches Next.js nativel (frontend) J Y Database Supabase (Postgres) + RLS gives multi-tenancy for free; native vector search for <mark>[</mark> embeddings; Mature, wel ~~l-~~ documented ~~—~~ lower hallucination risk for Al ~~-~~ Face Python (FastAPI) + generated code. Wrapped behind an internal interface so it processing <mark>[———_—S|</mark> (dllib) for vi can be swapped later without touching the rest of the app (see Section 6) 

Face 

processing Railway or Render Supports long ~~-~~ running background workers hosting 

Postgre ~~s-~~ based queue table Avoids adding Redis as a second infra dependency while the Queue (decided ~~—~~ do not leave as an team is small; revisit only if queue throughput becomes a open choice) measured bottleneck Auth Supabase Auth Built ~~-i~~ n rol ~~e-~~ based access (student/teacher/admin) Payments Razorpay Best fit for Indian institutions File/photoIp Supabase Storage Same RLS model as the database storage 

Rule for the Al coding assistant: no new library or service outside this table without explicitly flagging the deviation and the reason. Every added dependency is a new failure and hallucination surface. 

## 3. Mult ~~i-~~ Tenancy Model (build before any feature) 

Everytablecarries[ <mark>==———————_s|j.</mark> RLS‘ policies enforce isolation at the database level, not just in application code. 

v 

sql 

Apply this pattern to every table without exception. 

4. Database Schema (v2 ~~—~~ corrected) 

A sql 

create 

if not exists vector 

create table institutions primary key default name text not null text not null default ‘trial’ text not null default ‘active’ timestamptz default now 

create table users primary key references references not null role text not null check (role in 'admin''teacher'’student’ text not null 

create table rooms primary key default references not null name text not null block text text 

- ~~--~~ Cameras separated from rooms: a room may get a second camera later 

- ~~--~~ without a schema migration. 

- ~~--~~ RTSP URLs typically embed credentials (rtsp://User:pass@ip:port/stream). 

~~--~~ Never store that raw string in a normal table column. Store only a 

~~--~~ reference to a secret; the actual credential lives in the hosting 

~~--~~ platform's secret manager (Railway/Render env vars) or a dedicated 

~~--~~ encrypted secrets table with column- ~~l~~ evel encryption. The application 

~~--~~ resolves credential ~~_r~~ ef ~~-~~ > actual RTSP URL only inside the worker 

~~--~~ process, never in a value that could appear in a dashboard API response 

~~--~~ or a log line. 

create table cameras 

primary key default references not null references not null text not null 

text not null text not null ~~--~~ key name in secret manager, not the credential itself text default ‘primary’ 

boolean default 

~~--~~ status added: a student isn't just “exists” ~~—~~ they can be inactive 

~~--~~ (semester break), graduated, or transferred, all of which must stop 

~~--~~ matching without deleting historical attendance records. 

create table students 

primary key default references not null references status text not null default ‘active’ check ‘statusin ‘‘active''inactive''graduated''transferred' int default 0 

~~--~~ One row PER ENROLLMENT PHOTO, not one embedding per student. 

~~--~~ A single photo producesa fragile embedding (one angle, one lighting ~~--~~ condition). Storing each of the 4 ~~-~~ 5 enrollment photos as its own row 

~~--~~ lets matching compare against the best available representation 

~~--~~ (or an average) instead of one brittle vector. i ~~s_~~ primary marks the 

~~--~~ one used for quick previews in the dashboard. 

create table student ~~_b~~ iometrics 

primary key default 

references not null references not null vector (128 text not null default ‘dli ~~b_~~ resnet ~~_v~~ 1' int not null default1 boolean default float timestamptz default now 

create index on using 

create table classes 

primary key default references not null references not null subject text not null references text, ~~--~~ e.g. 'MON,WED,FRI 10:00 ~~-1~~ 1:00' boolean default 

~~--~~ Many ~~-t~~ o ~~-~~ many, replaces the v1 array column. Supports section changes, 

~~--~~ drops, late joins, and clean historical reporting. 

create table clas ~~s_~~ enrollments 

###### primary key default 

references not null references not null references not null 

status text not null default ‘active’ check ‘status in ‘active’'dropped' timestamptz default now 

unique 

~~--~~ One row per actual occurrence of a class, not per timetable slot. 

~~--~~ This is what everything else (observations, results, camera health) 

~~--~~ attaches to. 

- ~~--~~ Raw check ~~-i~~ n events pulled from the college's existing entry ~~-~~ scan 

- ~~--~~ device (e.g. Kent). This is a separate source of truth from anything ~~--~~ OUr own cameras observe ~~—~~ it tells Us WHO to watch for in a session, 

- ~~--~~ not how long they stayed. Populated by a sync job (Section 5, Phase A.5) 

- ~~--~~ via API polling or scheduled CSV import, whichever the vendor/college 

~~--~~ supports. 

create table externa ~~l_~~ checkin ~~_~~ events 

primary key default 

references not null text not null default ‘kent’ ~~--~~ vendor identifier, kept generic in case the device changes 

text not null ~~--~~ the ID the external system uses, mapped to our student ~~_i~~ d below references ~~--~~ resolved during sync; null if the ID couldn't be matched yet 

timestamptz not null 

references ~~--~~ resolved by matching checked ~~_i~~ n ~~_a~~ t against session tim ~~--~~ store whatever the vendor sends, for debugging mapping issues 

- timestamptz default now 

###### unique 

create table clas ~~s_~~ sessions 

primary key default 

references not null references not null references 

timestamptz not null 

timestamptz not null 

- ~~--~~ These are NOT set by a teacher action ~~—~~ they're derived automatically 

- ~~--~~ during finalization via quorum detection (Section 5, Phase E, step 0). 

- ~~--~~ actual ~~_~~ start/actua ~~l_~~ end represent when the class was genuinely in 

- ~~--~~ session, which can differ from the timetable if the teacher started 

~~--~~ late or ended early. Null until finalization runs; falls back to 

- ~~--~~ scheduled ~~_s~~ tart/schedule ~~d_~~ end if quorum was never reached (e.g. a ~~--~~ cancelled class, or a camera outage covering the whole session). timestamptz 

- timestamptz 

status text not null default ‘scheduled’ 

check ‘statusin ('‘scheduled’' ~~in~~ _progress'‘completed''cancelled' text default ‘unknown’ check in ‘unknown''healthy''degraded'offline’ text default ‘pending’ check in ‘pending''processing''finalized’'failed’ 

~~--~~ Was the session's monitoring roster built from external check ~~-i~~ n 

~~--~~ data, or (fallback) from the full clas ~~s_~~ enrollments list? Recorded 

~~--~~ explicitly so a finalization bug or a sync outage is visible in the 

~~--~~ data, not silently assumed. 

###### check 

text not null default ‘'externa ~~l_~~ checkin' in ‘externa ~~l_~~ checkin'’ful ~~l_~~ enrollment ~~_f~~ allback’ 

~~--~~ Set explicitly the moment finalization starts, and checked again 

- ~~--~~ before writing results. If a retry or duplicate job finds this 

- ~~--~~ already set, it exits without recomputing ~~—~~ this is what makes 

- ~~--~~ finalization idempotent rather than "probably fine because of the 

- ~~--~~ unique constraint downstream." 

   - timestamptz 

~~--~~ Every capture attempt ~~—~~ regardless of whether a usable frame came back. 

- ~~--~~ This is distinct from attendance ~~_o~~ bservations: a capture ~~_~~ event records 

- ~~--~~ "did the camera give us a frame", an observation records "what did we 

- ~~--~~ find in that frame". Separating them means a camera outage shows up 

- ~~--~~ immediately in its own record, not inferred later from a gap in 

- ~~--~~ observations. 

create table capture ~~_~~ events 

primary key default references not null references not null references not null timestamptz not null boolean not null text boolean default 

unique 

~~--~~ Raw evidence. Never overwritten ~~—~~ the final attendance status is a 

~~--~~ computed view derived from these rows, not the source of truth. 

create table attendance ~~_o~~ bservations primary key default 



references not null references not null references timestamptz not null float float 

- ~~--~~ unknown ~~_f~~ ace added: a face was detected and clear enough to embed, 

- ~~--~~ but didn't match anyone in the class roster. This is a different 

- ~~--~~ situation from "no ~~_f~~ ace" (nothing to analyze) or "low ~~_~~ confidence” 

- ~~--~~ (a candidate match that isn't trusted) ~~—~~ an unknown ~~_f~~ ace could bea 

- ~~--~~ visiting student, someone from a neighbouring section, or a genuine 

- ~~--~~ proxy attempt, and it's worth surfacing separately in review rather 

~~--~~ than silently discarding it. 

text not null 

check in ‘matched''low ~~_c~~ onfidence'’'n ~~o_~~ face'poor ~~_q~~ uality''unknown_ ~~f~~ ace''camera_ ~~fa~~ ilu text text 

unique 

create table fina ~~l_~~ attendance 

primary key default 

references not null references not null references not null float 

status text not null 

- check ‘statusin ('present'‘absent''le ~~ft~~ _early''uncertain'‘camera ~~_i~~ ssue’ 

- ~~--~~ true if a session ~~_~~ exceptions window influenced this result (excluded 

- ~~--~~ from scoring/gap ~~-~~ check). Kept as a simple flag rather than baking 

- ~~--~~ exception details into fina ~~l_~~ attendance itself ~~—~~ the full record 

- ~~--~~ lives in session ~~_~~ exceptions and is reachable via session ~~_i~~ d + student ~~_i~~ d. boolean default 

timestamptz default now 

unique 

~~--~~ A teacher ~~-~~ recorded exception for a student's genuine mid ~~-c~~ lass exit 

~~--~~ (emergency, family matter, sent on an errand, etc.). This is the 

~~--~~ *only* routine ~~-~~ adjacent teacher action the product asks for ~~—~~ a single 

~~--~~ tap, not a form ~~—~~ and it exists precisely so the automated gap ~~-~~ check 

~~--~~ (Section 5, Phase E, step 8) never has to guess about a legitimate 

~~--~~ absence. return ~~_a~~ t is optional: the teacher may not know exactly when 

~~--~~ the student will be back, and doesn't need to track it ~~—~~ the window 

~~--~~ this exception covers is simply excluded from scoring, whether the ~~--~~ student returns or not. 

create table session ~~_~~ exceptions primary key default references not null references not null references not null references not null ~~--~~ must be a teacher/admin, enforced by RLS text, ~~--~~ optional free text, e.g. "family emergency", "sent to office” timestamptz not null default now timestamptz, ~~--~~ nullable; teacher can fill in later, or never, if student didn't return timestamptz default now 

create table disputes primary key default 

references not null references not null references not null text status text default ‘pending’ check ‘status in ‘pending'’approved''rejected’ text timestamptz default now timestamptz 

~~--~~ Every status change a human makes is recorded. Cheap to add now, 

~~--~~ valuable for institutional trust and dispute resolution later. create table audit ~~_l~~ ogs primary key default 

references not null references 

action text not null text not null not null 

timestamptz default now 

create table camera ~~_h~~ ealth 



primary key references timestamptz int default 0 

status text default ‘unknown’ check (status in (‘'Unknown'‘healthy''degraded'offline’ text 

- ~~--~~ Actual storage for the thresholds mentioned in Phase E, not just a 

- ~~--~~ promise in prose that they're "versioned." One active row per 

- ~~--~~ institution (or a global default row when institution ~~_i~~ d is null). 

~~--~~ Finalization reads this table, never a hardcoded constant. 

create table attendance ~~_c~~ onfig primary key default references ~~--~~ null = platform default float not null default 0.70 float not null default 0.20 int not null default 3. ~~--~~ see Section 5, Phase E int not null default 10. ~~--~~ see Section 5, Phase E ~~—~~ mid ~~-c~~ lass exit flagging 

- ~~--~~ Quorum detection settings (see Section 5, Phase E, step 0): a sample 

- ~~--~~ round counts as "class was genuinely in session" if at least this 

~~--~~ fraction of the roster (or the absolute minimum count, whichever is 

- ~~--~~ higher) was matched in that round. 

float not null default 0.30 int not null default 3 

~~--~~ How far outside the timetabled window capture continues, so alate 

~~--~~ start or extended session still gets observed (see Section 5, Phase D). int not null default 15 

version int not null default 1 

timestamptz default now boolean default 

~~--~~ Aggregate, low ~~-c~~ ardinality counters for operational monitoring ~~—~~ 

~~--~~ how many frames processed, average recognition latency, match rate 

~~--~~ per session. Not per ~~-~~ observation detail (that's attendance_ ~~ob~~ servations)); 

~~--~~ this is what a monitoring dashboard queries so it isn’t scanning raw 

~~--~~ evidence tables. 

create table processing metrics primary key default 



references not null references int default 0 int default 0 float 





```
external_checkin_events
```

```
external_student_refstudents
```

```
checked_in_at
```

```
class_sessions
```

```
class_enrollments
```

```
session_id
```



```
roster_source = 'full_enrollment_fallback'
```

```
institutions
```

```
student_biometrics
```

```
classesclass_enrollments
```

```
students.id
```

```
class_sessionsclasses
```

```
in_progress
```

```
class_enrollmentsexternal_checkin_events
```

```
sleep()
```

```
scheduled_startscheduled_end
```

```
camera_healthconsecutive_failures += 1
```





```
student_biometrics
```

```
attendance_observations
session_exceptionsexit_at
return_at
completed
class_sessions.finalized_at
update ... where
finalized_at is null returning id
matched
quorum_fraction
min_quorum_countattendance_config
max(quorum_fraction × roster_size, min_quorum_count)
actual_startactual_end
scheduled_startscheduled_endcamera_issue
actual_startactual_end
actual_startactual_end
camera_health
camera_issueabsentuncertain
min_valid_observationsattendance_config
uncertain
presence_score[actual_start, actual_end]
session_exceptions
exit_atreturn_atexit_atactual_end
return_at
final_attendance.exception_applied = true
```

```
matched
actual_end
left_early
```

```
no_facepoor_quality
max_gap_minutesattendance_configleft_early
capture_eventscamera_health
left_early
```

```
uncertain
```

```
attendance_observations.match_statuspoor_quality
no_face
attendance_configpresent_thresholdleft_early_threshold
```

```
max_gap_minutes
```

```
final_attendanceclass_sessions.finalized_atactual_startactual_end
```

```
uncertaincamera_issue
```

```
audit_logs
```

```
class_sessions.finalized_atsession_exceptions
```

```
final_attendance
```

```
audit_logs
```





```
class_enrollments
```

###### **<mark>`attendance_observations`</mark>** 

```
unique(session_id, student_id, captured_at)
```

```
camera_health
```

```
status
```

```
inactivegraduatedtransferred
```

```
class_enrollments
```

```
roster_source = 'full_enrollment_fallback'
```

```
external_checkin_events.raw_payload
```

```
actual_startactual_end
```

```
scheduled_start
```

```
scheduled_end
```

Any code path that reads a session's time boundaries for scoring purposes must use the actual, derived values ~~—~~ the scheduled times exist for timetabling and captur ~~e-~~ window buffering only. <mark>—st~é‘___]C@an|</mark> ronly be created by a teacher or adminrole (enforcedbyRLSo <mark>n[____i),</mark> and every creation is implicitly auditable through the table itself plus[_ <mark>|</mark> whenit affects an already ~~-f~~ inalized result (Section 5, Phase F, step 4). This is the one place a human can pr ~~e-~~ empt an automated flag ~~—~~ it must never be reachable by a student marking their own exception. 

## Operational basics (add now ~~—~~ cheap, and painful to retrofit) 

API and upload rate limits: bulk student/photo upload endpoints and any public ~~-~~ facing API routes get rate limits from day one. A single misconfigured bulk ~~-~~ upload script or a scraping attempt should not be able to degrade the platform for every institution. 

Backup/recovery: Supabase's automatic backups must be confirmed enabled and their retention window documented before any real student data is loaded ~~—~~ this is a checkbox to verify, not new infrastructure to build. 

Processing metrics:the[ <mark>=————————S_=sd</mark> tale (Section 4) is written to from the queue workers so there's a basic operational view (frames processed, success rate, latency) without needing to query raw evidence tables during an incident. 

##### 8. On "zero teacher interaction" 

The product promise is zero routine teacher interaction ~~—~~ the teacher never takes attendance. It is not zero interaction under all conditions: camera failures, room changes, and ambiguous cases still need a human decision point. Marking a permitted exit for a student who genuinely needs to step out (Section 5, Phase D, step 7) is the one additional exception ~~—~~ a single, optional tap, used rarely, not a routine action for every class. The dashboard should make all of these rare exceptions fast to resolve, not pretend they can't happen. 

### 9. Privacy & Biometric Data Lifecycle 

This institution is handling sensitive biometric data ~~—~~ treat this section as part of the architecture, not an afterthought. 

Enrollment: only admins can upload/register student photos; students should be informed and, where required by institutional policy, give consent before enrollment. 

Storage:| <mark>————“—™s—SS—SsSS</mark> HOS ONIy the embedding vector, not raw photos, once enrollment is complete ~~—~~ the enrollment photos themselves can be deleted after the embedding is generated, reducing what's stored long ~~-~~ term. 

Evidence photos: kept only long enough to support the dispute window (Section 5, Phase F) ~~—~~ a short, configurable retention period, then deleted. 

Deletion: when a student leaves the institution, their[ <mark>sd=</mark> rowis deleted; 

<mark>[StS</mark> cori may be retained per the institution's own record ~~-~~ keeping requirements, but 

###### biometric data is not. 

Access: students see only their own attendance; teachers see only their assigned classes; admins see their institution; the platform operator does not need standing access to raw biometric data for normal operation. 

Do not hardcode specific retention durations ~~—~~ make them per ~~-i~~ nstitution configuration, since legal requirements vary. 



```
student_biometrics
```



```
full_enrollment_fallback
```



```
external_checkin_events
```

```
class_enrollments
```

```
camera_health
```

```
attendance_observations
```

```
class_sessions
```

```
final_attendance
```

```
uncertaincamera_issue
```

```
cameras
```

Using external check ~~-i~~ n photos as the enrollment source (raised in conversation) ~~—~~ worth revisiting only if the college's device turns out to export a photo per check ~~-i~~ n event. If/when that's confirmed, it could reduce or replace the manual student photo ~~-~~ upload step in Phase 1, but do not build this speculatively before confirming the device actually provides it 





|`class_ids uuid[]`|`class_enrollments`||
|---|---|---|
||`class_sessions`||
|`camera_rtsp_url`<br>`rooms`|`cameras`<br>`camera_health`||
|`matched boolean`<br>`confidence_score`|`attendance_observations`|`unknown_face`|
|||`capture_events`<br>`attendance_observations`|
|`unverified`|`uncertain`<br>`camera_issue`||
|||`attendance_config`<br>`ma`|
|||`status`|
||`audit_logs`||
|||`processing_metrics`|



v3 

~~—~~ 

~~— —~~ 

|Area<br>Queuetechnology|v1<br>Leftopen|v2<br>Decided: Postgresqueue ~~—~~|
|---|---|---|
|Recognition<br>g<br>implementation|Coupled todlib|Provider interface<br>~~—~~|
|oo,<br>Monitoring roster|Every enrolled student in the<br>class|~~—~~<br>~~—~~|
|Third~~-~~party<br>;<br>.<br>integration|None|None<br>None|
|Sessiontime<br>boundaries|[Lid<br>used directlyfor all scoring||
|Genuine mid~~-~~<br>class exits|Not modeled ~~— ~~a student<br>stepping out fora real reason<br>(emergency, errand) would<br>eventually triggerthesame<br>[flagsas<br>aproxyattempt|~~—~~<br>~~—~~|





<!-- Start of picture text -->
No<br><!-- End of picture text -->



<!-- Start of picture text -->
—<br><!-- End of picture text -->

Area 

v1 

v2 

v3 

### 13. Closing Note 

Across eight review rounds, the architecture has moved from a naive "recognize every enrolled student against the timetable" design to a layered one: external check ~~-i~~ n confirmation narrows the roster, quorum detection establishes when the class was genuinely in session, periodic evidence collection builds a presence picture within that real window, a teacher's one ~~-~~ tap permitted ~~-e~~ xit marking pr ~~e-~~ empts false proxy flags for genuine exits, qualit ~~y-~~ aware gap checking distinguishes real absence from occlusion for everything else, and ambiguous cases route to a human instead of a guess. Everything in Section 11 stays deferred, including treating external check ~~-i~~ n photos as an enrollment source. 

Two open rea ~~l-~~ world tasks before Phase 0 can fully start: 

Confirm with the college whether the external check ~~-i~~ n device offers an API or only scheduled exports, and get a sample export to see what fields are really available (drives Phase 1.5's exact implementation). Decide the <mark>default(= ——Sséd'</mark> (15 iS. Arreasconable starting point) with input from how much timetable slippage is actually typical at your college ~~—~~ this can also just be tuned after the first pilot. No further architecture changes are expected before implementation begins. If a future review ~~—~~ human orAl ~~—~~ proposes another structural change, treat that as a signal to start building and revisit after the pilot generates real data, not as a reason to keep revising the document. 

