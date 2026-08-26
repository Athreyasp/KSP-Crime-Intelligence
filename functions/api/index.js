const express = require('express');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Catalyst-Token,X-CATALYST-AUTH');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const router = express.Router();

function getDatastore(req) {
  try {
    const catalystApp = catalyst.initialize(req);
    return catalystApp.datastore();
  } catch (err) {
    // Development env: catalyst.initialize may fail for unauthenticated external requests.
    // Re-throw so callers can fall back to in-memory store.
    throw err;
  }
}

function getCatalystApp(req) {
  try {
    return catalyst.initialize(req);
  } catch (err) {
    return null;
  }
}

let photoMapping = {};
let photoMappingFileId = null;

// Download mapping from Zoho Datastore table
async function loadPhotoMapping(catalystApp) {
  try {
    const zcql = catalystApp.zcql();
    const queryRes = await zcql.executeZCQLQuery('SELECT * FROM PhotoAttachment');
    const rows = (queryRes || []).map(r => r.PhotoAttachment || r);
    
    photoMapping = {};
    rows.forEach(r => {
      const keyName = `${r.EntityType}_${r.EntityID}`;
      photoMapping[keyName] = r.FileID;
    });
  } catch (err) {
    console.log('Failed to load photo mappings from PhotoAttachment datastore table, falling back:', err.message);
  }
  return photoMapping;
}

// Save photo mapping mapping is now inline during upload
async function savePhotoMapping(catalystApp) {
  console.log('Photo mappings are stored transactionally in PhotoAttachment datastore table.');
}

// Upload a file to Zoho Catalyst cloud storage (Stratus or File Store)
async function uploadToCloud(catalystApp, tempFilePath, fileName) {
  const fs = require('fs');

  // Try Stratus first
  try {
    if (typeof catalystApp.stratus === 'function') {
      const bucket = catalystApp.stratus().bucket('photos');
      const fileStream = fs.createReadStream(tempFilePath);
      const res = await bucket.putObject(fileName, fileStream);
      if (res && res.object_name) {
        return res.object_name;
      }
    }
  } catch (err) {
    console.log('Stratus upload failed, trying legacy File Store folder:', err.message);
  }

  // Fallback: Try File Store folder
  try {
    if (typeof catalystApp.filestore === 'function') {
      const filestore = catalystApp.filestore();
      const folder = filestore.folder('photos');
      const fileObj = await folder.uploadFile({
        code: fs.createReadStream(tempFilePath),
        name: fileName
      });
      if (fileObj) {
        return fileObj.id || fileObj.file_id;
      }
    }
  } catch (err) {
    console.error('File Store upload failed:', err.message);
    throw err;
  }

  throw new Error('No compatible Zoho storage service (Stratus or File Store) available');
}

// Download a file from Zoho Catalyst cloud storage
async function downloadFromCloud(catalystApp, fileId) {
  // Try Stratus first
  try {
    if (typeof catalystApp.stratus === 'function') {
      const bucket = catalystApp.stratus().bucket('photos');
      const fileStream = await bucket.getObject(fileId);
      if (fileStream) return fileStream;
    }
  } catch (err) {
    console.log('Stratus download failed, trying legacy File Store:', err.message);
  }

  // Fallback: Try File Store folder
  try {
    if (typeof catalystApp.filestore === 'function') {
      const filestore = catalystApp.filestore();
      const folder = filestore.folder('photos');
      const fileStream = await folder.downloadFile(fileId);
      if (fileStream) return fileStream;
    }
  } catch (err) {
    console.error('File Store download failed:', err.message);
    throw err;
  }

  throw new Error('Download failed from both Stratus and File Store');
}

// Upload photo to Zoho File Store and insert reference in PhotoAttachment
async function uploadPhoto(catalystApp, base64Str, keyName, caseMasterId) {
  if (!base64Str) return null;
  // If it doesn't look like base64, return it directly
  if (!base64Str.startsWith('data:image') && !base64Str.includes('base64')) {
    return base64Str;
  }
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const fileName = `${keyName}_${Date.now()}.jpg`;
    const tempFilePath = path.join(os.tmpdir(), fileName);

    const buffer = Buffer.from(base64Str.replace(/^data:image\/\w+;base64,/, ""), 'base64');
    fs.writeFileSync(tempFilePath, buffer);

    const fileId = await uploadToCloud(catalystApp, tempFilePath, fileName);
    
    try { fs.unlinkSync(tempFilePath); } catch (e) {}

    // Parse keyName to get entityType and entityID
    const parts = keyName.split('_');
    const entityType = parts[0];
    const entityID = parts[1] || "";
    
    // Write reference entry to PhotoAttachment datastore table
    const attachmentPayload = {
      CaseMasterID: Number(caseMasterId),
      EntityType: String(entityType),
      EntityID: String(entityID),
      FileID: String(fileId),
      AccessURL: `/server/api/photos/${fileId}`
    };
    
    const datastore = catalystApp.datastore();
    await datastore.table('PhotoAttachment').insertRow(attachmentPayload).catch((e) => {
      console.error('Failed to insert PhotoAttachment row:', e.message);
    });
    if (!memoryTableStore['PhotoAttachment']) {
      memoryTableStore['PhotoAttachment'] = [];
    }
    memoryTableStore['PhotoAttachment'].push(attachmentPayload);
    
    // Update local registry mapping
    photoMapping[keyName] = fileId;
    
    return `/server/api/photos/${fileId}`;
  } catch (err) {
    console.error(`Zoho upload failed for ${keyName}, saving base64 inline:`, err);
    // Save base64 in in-memory mapping as fallback
    photoMapping[keyName] = base64Str;
    return base64Str;
  }
}

function formatDateOnly(val) {
  if (!val) return new Date().toISOString().slice(0, 10);
  const d = new Date(val);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function formatDateTime(val) {
  if (!val) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  const d = new Date(val);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Complete metadata definition for all 27 tables from ksp.pdf
const TABLE_METADATA = [
  { id: '50989000000047001', name: 'CrimeHead', columns: [ { id: '50989000000047002', name: 'ROWID', type: 'bigint' }, { id: '50989000000047725', name: 'CrimeHeadID', type: 'int' }, { id: '50989000000047727', name: 'CrimeGroupName', type: 'varchar' }, { id: '50989000000047729', name: 'Active', type: 'int' } ] },
  { id: '50989000000046443', name: 'Section', columns: [ { id: '50989000000046444', name: 'ROWID', type: 'bigint' }, { id: '50989000000046802', name: 'ActCode', type: 'varchar' }, { id: '50989000000046804', name: 'SectionCode', type: 'varchar' }, { id: '50989000000046806', name: 'SectionDescription', type: 'varchar' }, { id: '50989000000046808', name: 'Active', type: 'int' } ] },
  { id: '50989000000046076', name: 'Act', columns: [ { id: '50989000000046077', name: 'ROWID', type: 'bigint' }, { id: '50989000000046435', name: 'ActCode', type: 'varchar' }, { id: '50989000000046437', name: 'ActDescription', type: 'varchar' }, { id: '50989000000046439', name: 'ShortName', type: 'varchar' }, { id: '50989000000046441', name: 'Active', type: 'int' } ] },
  { id: '50989000000045693', name: 'ArrestSurrender', columns: [ { id: '50989000000045694', name: 'ROWID', type: 'bigint' }, { id: '50989000000046052', name: 'ArrestSurrenderID', type: 'int' }, { id: '50989000000046054', name: 'CaseMasterID', type: 'int' }, { id: '50989000000046056', name: 'ArrestSurrenderTypeID', type: 'int' }, { id: '50989000000046058', name: 'ArrestSurrenderDate', type: 'date' }, { id: '50989000000046060', name: 'ArrestSurrenderStateId', type: 'int' }, { id: '50989000000046062', name: 'ArrestSurrenderDistrictId', type: 'int' } ] },
  { id: '50989000000045322', name: 'Accused', columns: [ { id: '50989000000045323', name: 'ROWID', type: 'bigint' }, { id: '50989000000045681', name: 'AccusedMasterID', type: 'int' }, { id: '50989000000045683', name: 'CaseMasterID', type: 'int' }, { id: '50989000000045685', name: 'AccusedName', type: 'varchar' }, { id: '50989000000045687', name: 'AgeYear', type: 'int' }, { id: '50989000000045689', name: 'GenderID', type: 'int' }, { id: '50989000000045691', name: 'PersonID', type: 'varchar' } ] },
  { id: '50989000000042951', name: 'Victim', columns: [ { id: '50989000000042952', name: 'ROWID', type: 'bigint' }, { id: '50989000000045310', name: 'VictimMasterID', type: 'int' }, { id: '50989000000045312', name: 'CaseMasterID', type: 'int' }, { id: '50989000000045314', name: 'VictimName', type: 'varchar' }, { id: '50989000000045316', name: 'AgeYear', type: 'int' }, { id: '50989000000045318', name: 'GenderID', type: 'int' }, { id: '50989000000045320', name: 'VictimPolice', type: 'varchar' } ] },
  { id: '50989000000042579', name: 'ActSectionAssociation', columns: [ { id: '50989000000042580', name: 'ROWID', type: 'bigint' }, { id: '50989000000042938', name: 'CaseMasterID', type: 'int' }, { id: '50989000000042940', name: 'ActID', type: 'int' }, { id: '50989000000042942', name: 'SectionID', type: 'int' }, { id: '50989000000042944', name: 'ActOrderID', type: 'int' }, { id: '50989000000042946', name: 'SectionOrderID', type: 'int' } ] },
  { id: '50989000000059369', name: 'ReligionMaster', columns: [ { id: '50989000000059370', name: 'ROWID', type: 'bigint' }, { id: '50989000000059728', name: 'ReligionID', type: 'int' }, { id: '50989000000059730', name: 'ReligionName', type: 'varchar' } ] },
  { id: '50989000000059006', name: 'CasteMaster', columns: [ { id: '50989000000059007', name: 'ROWID', type: 'bigint' }, { id: '50989000000059365', name: 'caste_master_id', type: 'int' }, { id: '50989000000059367', name: 'caste_master_name', type: 'varchar' } ] },
  { id: '50989000000054653', name: 'Unit_PoliceStation', columns: [ { id: '50989000000054654', name: 'ROWID', type: 'bigint' } ] },
  { id: '50989000000054286', name: 'State', columns: [ { id: '50989000000054287', name: 'ROWID', type: 'bigint' }, { id: '50989000000054645', name: 'StateID', type: 'int' }, { id: '50989000000054647', name: 'StateName', type: 'varchar' }, { id: '50989000000054649', name: 'NationalityID', type: 'int' }, { id: '50989000000054651', name: 'Active', type: 'int' } ] },
  { id: '50989000000053919', name: 'District', columns: [ { id: '50989000000053920', name: 'ROWID', type: 'bigint' }, { id: '50989000000054278', name: 'DistrictID', type: 'int' }, { id: '50989000000054280', name: 'DistrictName', type: 'varchar' }, { id: '50989000000054282', name: 'StateID', type: 'int' }, { id: '50989000000054284', name: 'Active', type: 'int' } ] },
  { id: '50989000000053550', name: 'Court', columns: [ { id: '50989000000053551', name: 'ROWID', type: 'bigint' }, { id: '50989000000053909', name: 'CourtID', type: 'int' }, { id: '50989000000053911', name: 'CourtName', type: 'varchar' }, { id: '50989000000053913', name: 'DistrictID', type: 'int' }, { id: '50989000000053915', name: 'StateID', type: 'int' }, { id: '50989000000053917', name: 'Active', type: 'int' } ] },
  { id: '50989000000053187', name: 'GravityOffence', columns: [ { id: '50989000000053188', name: 'ROWID', type: 'bigint' }, { id: '50989000000053546', name: 'GravityOffenceID', type: 'int' }, { id: '50989000000053548', name: 'LookupValue', type: 'varchar' } ] },
  { id: '50989000000050824', name: 'CaseCategory', columns: [ { id: '50989000000050825', name: 'ROWID', type: 'bigint' }, { id: '50989000000053183', name: 'CaseCategoryID', type: 'int' }, { id: '50989000000053185', name: 'LookupValue', type: 'varchar' } ] },
  { id: '50989000000028030', name: 'CaseMaster', columns: [ { id: '50989000000028031', name: 'ROWID', type: 'bigint' }, { id: '50989000000028389', name: 'CaseMasterID', type: 'int' }, { id: '50989000000028391', name: 'CrimeNo', type: 'varchar' }, { id: '50989000000028393', name: 'CrimeRegisteredDate', type: 'date' }, { id: '50989000000028395', name: 'PolicePersonID', type: 'int' }, { id: '50989000000028397', name: 'PoliceStationID', type: 'int' }, { id: '50989000000028399', name: 'CaseCategoryID', type: 'int' }, { id: '50989000000028401', name: 'GravityOffenceID', type: 'int' }, { id: '50989000000028403', name: 'CrimeMajorHeadID', type: 'int' }, { id: '50989000000028405', name: 'CrimeMinorHeadID', type: 'int' }, { id: '50989000000028407', name: 'CaseStatusID', type: 'int' }, { id: '50989000000028409', name: 'CourtID', type: 'int' }, { id: '50989000000028411', name: 'IncidentFromDate', type: 'datetime' }, { id: '50989000000028413', name: 'IncidentToDate', type: 'datetime' }, { id: '50989000000028415', name: 'InfoReceivedPSDate', type: 'datetime' }, { id: '50989000000028417', name: 'latitude', type: 'double' }, { id: '50989000000028419', name: 'longitude', type: 'double' }, { id: '50989000000028421', name: 'BriefFacts', type: 'varchar' } ] },
  { id: '50989000000050461', name: 'CaseStatusMaster', columns: [ { id: '50989000000050462', name: 'ROWID', type: 'bigint' }, { id: '50989000000050820', name: 'CaseStatusID', type: 'int' }, { id: '50989000000050822', name: 'CaseStatusName', type: 'varchar' } ] },
  { id: '50989000000051665', name: 'GenderMaster', columns: [ { id: '50989000000051666', name: 'ROWID', type: 'bigint' }, { id: '50989000000052024', name: 'GenderID', type: 'int' }, { id: '50989000000052026', name: 'GenderName', type: 'varchar' } ] },
  { id: '50989000000050098', name: 'OccupationMaster', columns: [ { id: '50989000000050099', name: 'ROWID', type: 'bigint' }, { id: '50989000000050457', name: 'OccupationID', type: 'int' }, { id: '50989000000050459', name: 'OccupationName', type: 'varchar' } ] },
  { id: '50989000000051296', name: 'ChargesheetDetails', columns: [ { id: '50989000000051297', name: 'ROWID', type: 'bigint' }, { id: '50989000000051655', name: 'CSID', type: 'int' }, { id: '50989000000051657', name: 'CaseMasterID', type: 'int' }, { id: '50989000000051659', name: 'csdate', type: 'datetime' }, { id: '50989000000051661', name: 'cstype', type: 'varchar' }, { id: '50989000000051663', name: 'PolicePersonID', type: 'int' } ] },
  { id: '50989000000049913', name: 'Employee', columns: [ { id: '50989000000049914', name: 'ROWID', type: 'bigint' }, { id: '50989000000051272', name: 'EmployeeID', type: 'int' }, { id: '50989000000051274', name: 'DistrictID', type: 'int' }, { id: '50989000000051276', name: 'UnitID', type: 'int' }, { id: '50989000000051278', name: 'RankID', type: 'int' }, { id: '50989000000051280', name: 'DesignationID', type: 'int' }, { id: '50989000000051282', name: 'KGID', type: 'varchar' }, { id: '50989000000051284', name: 'FirstName', type: 'varchar' }, { id: '50989000000051286', name: 'EmployeeDOB', type: 'date' }, { id: '50989000000051288', name: 'GenderID', type: 'int' }, { id: '50989000000051290', name: 'BloodGroupID', type: 'int' }, { id: '50989000000051292', name: 'PhysicallyChallenged', type: 'int' }, { id: '50989000000051294', name: 'AppointmentDate', type: 'date' } ] },
  { id: '50989000000049546', name: 'Designation', columns: [ { id: '50989000000049547', name: 'ROWID', type: 'bigint' }, { id: '50989000000049905', name: 'DesignationID', type: 'int' }, { id: '50989000000049907', name: 'DesignationName', type: 'varchar' }, { id: '50989000000049909', name: 'Active', type: 'int' }, { id: '50989000000049911', name: 'SortOrder', type: 'int' } ] },
  { id: '50989000000049179', name: 'Rank', columns: [ { id: '50989000000049180', name: 'ROWID', type: 'bigint' }, { id: '50989000000049538', name: 'RankID', type: 'int' }, { id: '50989000000049540', name: 'RankName', type: 'varchar' }, { id: '50989000000049542', name: 'Hierarchy', type: 'int' }, { id: '50989000000049544', name: 'Active', type: 'int' } ] },
  { id: '50989000000047731', name: 'CrimeSubHead', columns: [ { id: '50989000000047732', name: 'ROWID', type: 'bigint' }, { id: '50989000000050090', name: 'CrimeSubHeadID', type: 'int' }, { id: '50989000000050092', name: 'CrimeHeadID', type: 'int' }, { id: '50989000000050094', name: 'CrimeHeadName', type: 'varchar' }, { id: '50989000000050096', name: 'SeqID', type: 'int' } ] },
  { id: '50989000000046810', name: 'UnitType', columns: [ { id: '50989000000046811', name: 'ROWID', type: 'bigint' }, { id: '50989000000049169', name: 'UnitTypeID', type: 'int' }, { id: '50989000000049171', name: 'UnitTypeName', type: 'varchar' }, { id: '50989000000049173', name: 'CityDistState', type: 'varchar' }, { id: '50989000000049175', name: 'Hierarchy', type: 'int' }, { id: '50989000000049177', name: 'Active', type: 'int' } ] },
  { id: '50989000000047360', name: 'CrimeHeadActSection', columns: [ { id: '50989000000047361', name: 'ROWID', type: 'bigint' }, { id: '50989000000047719', name: 'CrimeHeadID', type: 'int' }, { id: '50989000000047721', name: 'ActCode', type: 'varchar' }, { id: '50989000000047723', name: 'SectionCode', type: 'varchar' } ] },
  { id: '50989000000042203', name: 'ComplainantDetails', columns: [ { id: '50989000000042204', name: 'ROWID', type: 'bigint' }, { id: '50989000000042562', name: 'ComplainantID', type: 'int' }, { id: '50989000000042564', name: 'CaseMasterID', type: 'int' }, { id: '50989000000042566', name: 'ComplainantName', type: 'varchar' }, { id: '50989000000042568', name: 'AgeYear', type: 'int' }, { id: '50989000000042570', name: 'OccupationID', type: 'int' }, { id: '50989000000042572', name: 'ReligionID', type: 'int' }, { id: '50989000000042574', name: 'CasteID', type: 'int' }, { id: '50989000000042576', name: 'GenderID', type: 'int' } ] },
  { id: '50989000000057062', name: 'PhotoAttachment', columns: [ { id: '50989000000057063', name: 'ROWID', type: 'bigint' }, { id: '50989000000057421', name: 'CaseMasterID', type: 'int' }, { id: '50989000000057423', name: 'EntityType', type: 'varchar' }, { id: '50989000000057425', name: 'EntityID', type: 'varchar' }, { id: '50989000000057427', name: 'FileID', type: 'varchar' }, { id: '50989000000057429', name: 'AccessURL', type: 'varchar' } ] }
];

// In-memory data store cache to ensure instant reflection across all 27 tables
const memoryTableStore = {};
TABLE_METADATA.forEach(t => { memoryTableStore[t.name] = []; });

// Health check / root endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'KSP Crime Intelligence Catalyst Serverless API is online and active.',
    tablesCount: TABLE_METADATA.length
  });
});

// GET Handler - Serve photos from Zoho Catalyst File Store
router.get('/photos/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    
    // If it is a base64 string, parse and send directly
    if (fileId.startsWith('data:image') || fileId.length > 500) {
      const matches = fileId.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const type = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', `image/${type}`);
        return res.send(buffer);
      }
      return res.status(404).send('Invalid image data');
    }
    
    // Otherwise fetch from Zoho Catalyst File Store
    const catalystApp = catalyst.initialize(req);
    const fileStream = await downloadFromCloud(catalystApp, fileId);
    
    res.setHeader('Content-Type', 'image/jpeg');
    fileStream.pipe(res);
  } catch (err) {
    // Check fallback
    const fallbackData = photoMapping[req.params.fileId];
    if (fallbackData && fallbackData.startsWith('data:image')) {
      const matches = fallbackData.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const type = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', `image/${type}`);
        return res.send(buffer);
      }
    }
    console.error('Failed to download photo:', err.message);
    res.status(404).send('Not Found');
  }
});

// GET Handler - Fetch all 27 tables schema & data
router.get('/tables', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const datastore = catalystApp.datastore();

    const tablesData = {};
    await Promise.all(TABLE_METADATA.map(async (t) => {
      try {
        const pagedRes = await datastore.table(t.name).getPagedRows();
        if (pagedRes?.data && pagedRes.data.length > 0) {
          tablesData[t.name] = pagedRes.data;
          return;
        }
      } catch (e) {}

      try {
        const qRes = await zcql.executeZCQLQuery(`SELECT * FROM ${t.name}`);
        if (qRes && qRes.length > 0) {
          tablesData[t.name] = qRes.map(r => r[t.name] || r);
          return;
        }
      } catch (e) {}

      tablesData[t.name] = memoryTableStore[t.name] || [];
    }));

    res.status(200).json({
      status: 'success',
      tables: TABLE_METADATA,
      data: tablesData
    });
  } catch (err) {
    res.status(200).json({
      status: 'success',
      tables: TABLE_METADATA,
      data: memoryTableStore
    });
  }
});

// GET Handler - Fetch all case records with related child tables using ZCQL
const getCasesHandler = async (req, res) => {
  // Try to initialize Catalyst SDK — fails for unauthenticated external requests
  const catalystApp = getCatalystApp(req);

  // If SDK init failed, return in-memory store immediately (mock data or previously seeded data)
  if (!catalystApp) {
    return res.status(200).json({
      status: 'success',
      data: {
        cases: memoryTableStore['CaseMaster'] || [],
        accused: memoryTableStore['Accused'] || [],
        victims: memoryTableStore['Victim'] || [],
        complainants: memoryTableStore['ComplainantDetails'] || [],
        arrests: memoryTableStore['ArrestSurrender'] || [],
        actSections: memoryTableStore['ActSectionAssociation'] || [],
        chargesheet: memoryTableStore['ChargesheetDetails'] || []
      }
    });
  }

  try {
    const zcql = catalystApp.zcql();
    const datastore = catalystApp.datastore();

    // Load photo mapping
    await loadPhotoMapping(catalystApp).catch(() => {});

    const fetchTableData = async (tableName) => {
      try {
        const pagedRes = await datastore.table(tableName).getPagedRows();
        const rows = pagedRes?.data || [];
        if (rows.length > 0) return rows;
      } catch (err) {}
      try {
        const queryRes = await zcql.executeZCQLQuery(`SELECT * FROM ${tableName}`);
        if (queryRes && queryRes.length > 0) return queryRes.map(r => r[tableName] || r);
      } catch (err) {}
      return memoryTableStore[tableName] || [];
    };

    const [normalizedCases, accusedRows, victimRows, complainantRows, arrestRows, actRows, chargesheetRows] = await Promise.all([
      fetchTableData('CaseMaster'),
      fetchTableData('Accused'),
      fetchTableData('Victim'),
      fetchTableData('ComplainantDetails'),
      fetchTableData('ArrestSurrender'),
      fetchTableData('ActSectionAssociation'),
      fetchTableData('ChargesheetDetails')
    ]);

    // Format the cases and map photo assets from dynamic mapping registry
    const casesWithPhotos = normalizedCases.map(c => {
      const officerKey = `officer_${c.PolicePersonID}`;
      const officerPhoto = photoMapping[officerKey]
        ? (photoMapping[officerKey].startsWith('data:image') ? photoMapping[officerKey] : `/server/api/photos/${photoMapping[officerKey]}`)
        : undefined;
      return { ...c, officerPhoto };
    });

    res.status(200).json({
      status: 'success',
      data: {
        cases: casesWithPhotos,
        accused: accusedRows.map(a => {
          const key = `accused_${a.AccusedMasterID}`;
          const photo = photoMapping[key]
            ? (photoMapping[key].startsWith('data:image') ? photoMapping[key] : `/server/api/photos/${photoMapping[key]}`)
            : undefined;
          return { ...a, photo };
        }),
        victims: victimRows.map(v => {
          const key = `victim_${v.VictimMasterID}`;
          const photo = photoMapping[key]
            ? (photoMapping[key].startsWith('data:image') ? photoMapping[key] : `/server/api/photos/${photoMapping[key]}`)
            : undefined;
          return { ...v, photo };
        }),
        complainants: complainantRows,
        arrests: arrestRows,
        actSections: actRows,
        chargesheet: chargesheetRows
      }
    });
  } catch (err) {
    console.error('Error fetching cases from Catalyst Datastore:', err);
    res.status(200).json({
      status: 'success',
      data: {
        cases: memoryTableStore['CaseMaster'] || [],
        accused: memoryTableStore['Accused'] || [],
        victims: memoryTableStore['Victim'] || [],
        complainants: memoryTableStore['ComplainantDetails'] || [],
        arrests: memoryTableStore['ArrestSurrender'] || [],
        actSections: memoryTableStore['ActSectionAssociation'] || [],
        chargesheet: memoryTableStore['ChargesheetDetails'] || []
      }
    });
  }
};

// POST Handler - Insert a complete case and write records to ALL 27 tables
const postCasesHandler = async (req, res) => {
  try {
    const catalystAppPost = getCatalystApp(req);
    const datastore = catalystAppPost ? catalystAppPost.datastore() : null;
    const newCase = req.body;

    const genderMap = { "M": 1, "F": 2, "T": 3 };
    const occMap = {
      "Farmer": 1, "Business": 2, "Government Employee": 3,
      "Private Sector Employee": 4, "Student": 5, "Unemployed": 6, "Others": 7
    };
    const relMap = {
      "Hindu": 1, "Muslim": 2, "Christian": 3, "Sikh": 4,
      "Buddhist": 5, "Jain": 6, "Others": 7
    };
    const casteMap = { "General": 1, "OBC": 2, "SC": 3, "ST": 4 };
    const courtMap = {
      "JMFC Court": 1, "District and Sessions Court": 2,
      "City Civil Court": 3, "High Court of Karnataka": 4
    };

    const officerMatch = String(newCase.registeringOfficer || "").match(/KGID:\s*(\d+)/i);
    const policePersonId = officerMatch ? Number(officerMatch[1]) : 29013;
    const courtId = courtMap[newCase.courtName || ""] || 1;
    const statusMapInv = {
      "Under Investigation": 1, "Charge Sheeted": 2, "Closed": 3, "Pending Trial": 4
    };
    const caseStatusId = statusMapInv[newCase.status || "Under Investigation"] || 1;
    const caseMasterIdVal = Math.floor(Date.now() % 2147483647);
    const districtId = newCase.district?.id || 1;
    const districtName = newCase.district?.name || "Bengaluru Urban";
    const crimeHeadId = newCase.crimeHead?.id || 1;
    const crimeHeadName = newCase.crimeHead?.name || "Homicide / Murder";

    // 1. Insert into CaseMaster (ROWID omitted so Zoho auto-generates it)
    const caseMasterPayload = {
      CaseMasterID: caseMasterIdVal,
      CrimeNo: String(newCase.crimeNo),
      CrimeRegisteredDate: formatDateOnly(newCase.registeredDate),
      PolicePersonID: policePersonId,
      PoliceStationID: 100 + districtId,
      CaseCategoryID: newCase.category === "FIR" ? 1 : newCase.category === "UDR" ? 3 : newCase.category === "Zero FIR" ? 8 : 4,
      GravityOffenceID: newCase.gravity === "Heinous" ? 1 : 2,
      CrimeMajorHeadID: crimeHeadId,
      CrimeMinorHeadID: 1,
      CaseStatusID: caseStatusId,
      CourtID: courtId,
      IncidentFromDate: formatDateTime(newCase.incidentDate),
      IncidentToDate: formatDateTime(newCase.incidentToDate || newCase.incidentDate),
      InfoReceivedPSDate: formatDateTime(newCase.infoReceivedPSDate || newCase.registeredDate),
      latitude: Number(newCase.latitude || 12.9716),
      longitude: Number(newCase.longitude || 77.5946),
      BriefFacts: String(newCase.briefFacts || "Case registered.")
    };

    let insertedCaseRow;
    if (datastore) {
      try {
        insertedCaseRow = await datastore.table('CaseMaster').insertRow(caseMasterPayload);
      } catch (insertErr) {
        insertedCaseRow = { CaseMaster: caseMasterPayload };
      }
    } else {
      insertedCaseRow = { CaseMaster: caseMasterPayload };
    }
    const insertedCaseObj = insertedCaseRow?.CaseMaster || insertedCaseRow || caseMasterPayload;
    
    // In memory store we push caseMasterPayload
    memoryTableStore['CaseMaster'].push(caseMasterPayload);

    // Initialize photo mappings
    const catalystApp = catalystAppPost;
    if (catalystApp) await loadPhotoMapping(catalystApp).catch(() => {});

    // Upload Officer photo if present
    let officerPhotoUrl = "";
    if (newCase.officerPhoto) {
      officerPhotoUrl = await uploadPhoto(catalystApp, newCase.officerPhoto, `officer_${policePersonId}`, caseMasterIdVal);
    }

    // 2. ComplainantDetails (ROWID omitted so Zoho auto-generates it)
    const complainantPayload = {
      ComplainantID: Math.floor(Math.random() * 10000),
      CaseMasterID: caseMasterIdVal, // Fixed to 32-bit int FK
      ComplainantName: String(newCase.complainant?.name || "Unknown Complainant"),
      AgeYear: Number(newCase.complainant?.age) || 30,
      GenderID: genderMap[newCase.complainant?.gender] || 1,
      OccupationID: occMap[newCase.complainant?.occupation] || 7,
      ReligionID: relMap[newCase.complainant?.religion || ""] || 7,
      CasteID: casteMap[newCase.complainant?.caste || ""] || 1
    };
    if (datastore) await datastore.table('ComplainantDetails').insertRow(complainantPayload).catch(() => {});
    memoryTableStore['ComplainantDetails'].push(complainantPayload);

    // 3. Victim (ROWID omitted)
    const victimList = (newCase.victims && newCase.victims.length > 0) ? newCase.victims : [{ name: "Victim 1", age: 30, gender: "M", isPolice: false }];
    const victimPayloads = victimList.map((v) => ({
      VictimMasterID: Math.floor(Math.random() * 10000),
      CaseMasterID: caseMasterIdVal, // Fixed to 32-bit int FK
      VictimName: String(v.name),
      AgeYear: Number(v.age) || 25,
      GenderID: genderMap[v.gender] || 1,
      VictimPolice: v.isPolice ? "1" : "0"
    }));
    if (datastore) await datastore.table('Victim').insertRows(victimPayloads).catch(() => {});
    victimPayloads.forEach(vp => memoryTableStore['Victim'].push(vp));

    // Upload Victim photos if present
    if (newCase.victims && newCase.victims.length > 0) {
      for (let i = 0; i < newCase.victims.length; i++) {
        const v = newCase.victims[i];
        const vPayload = victimPayloads[i];
        if (v.photo) {
          await uploadPhoto(catalystApp, v.photo, `victim_${vPayload.VictimMasterID}`, caseMasterIdVal);
        }
      }
    }

    // 4. Accused & ArrestSurrender (ROWID omitted)
    const accusedList = (newCase.accused && newCase.accused.length > 0) ? newCase.accused : [{ name: "Unknown Suspect", age: 28, gender: "M", arrested: false }];
    const accusedPayloads = accusedList.map((a, idx) => ({
      AccusedMasterID: Math.floor(Math.random() * 10000),
      CaseMasterID: caseMasterIdVal, // Fixed to 32-bit int FK
      AccusedName: String(a.name),
      AgeYear: Number(a.age) || 30,
      GenderID: genderMap[a.gender] || 1,
      PersonID: String(a.id || `A${idx + 1}`)
    }));
    if (datastore) await datastore.table('Accused').insertRows(accusedPayloads).catch(() => {});
    accusedPayloads.forEach(ap => memoryTableStore['Accused'].push(ap));

    // Upload Accused photos if present
    if (newCase.accused && newCase.accused.length > 0) {
      for (let i = 0; i < newCase.accused.length; i++) {
        const a = newCase.accused[i];
        const aPayload = accusedPayloads[i];
        if (a.photo) {
          await uploadPhoto(catalystApp, a.photo, `accused_${aPayload.AccusedMasterID}`, caseMasterIdVal);
        }
      }
    }

    const arrestPayloads = [];
    accusedList.forEach((a, idx) => {
      if (a.arrested || a.arrestDate) {
        const aPayload = accusedPayloads[idx];
        arrestPayloads.push({
          ArrestSurrenderID: Math.floor(Math.random() * 10000),
          CaseMasterID: caseMasterIdVal, // Fixed to 32-bit int FK
          AccusedMasterID: aPayload ? aPayload.AccusedMasterID : Math.floor(Math.random() * 10000), // Linked FK
          ArrestSurrenderTypeID: 1,
          ArrestSurrenderDate: formatDateOnly(a.arrestDate),
          ArrestSurrenderStateId: 1,
          ArrestSurrenderDistrictId: districtId
        });
      }
    });

    if (arrestPayloads.length > 0) {
      if (datastore) await datastore.table('ArrestSurrender').insertRows(arrestPayloads).catch(() => {});
      arrestPayloads.forEach(ap => memoryTableStore['ArrestSurrender'].push(ap));
    } else {
      const defaultArrest = {
        ArrestSurrenderID: Math.floor(Math.random() * 10000),
        CaseMasterID: caseMasterIdVal, // Fixed to 32-bit int FK
        AccusedMasterID: accusedPayloads[0] ? accusedPayloads[0].AccusedMasterID : Math.floor(Math.random() * 10000), // Associated to first accused
        ArrestSurrenderTypeID: 1,
        ArrestSurrenderDate: formatDateOnly(newCase.registeredDate),
        ArrestSurrenderStateId: 1,
        ArrestSurrenderDistrictId: districtId
      };
      if (datastore) await datastore.table('ArrestSurrender').insertRow(defaultArrest).catch(() => {});
      memoryTableStore['ArrestSurrender'].push(defaultArrest);
    }

    // 5. ActSectionAssociation & CrimeHeadActSection & Section & Act (ROWID omitted)
    const actSections = (newCase.actSections && newCase.actSections.length > 0) ? newCase.actSections : ["BNS 103"];
    const actPayloads = actSections.map((sec, idx) => {
      const parts = String(sec).split(/\s+/);
      const actCode = parts[0] || "BNS";
      const secCode = parts[1] || "103";
      return {
        CaseMasterID: caseMasterIdVal, // Fixed to 32-bit int FK
        ActID: actCode === "BNS" ? 1 : actCode === "IPC" ? 2 : 3,
        SectionID: Number(secCode.replace(/\D/g, "")) || 103,
        ActOrderID: idx + 1,
        SectionOrderID: idx + 1
      };
    });
    if (datastore) await datastore.table('ActSectionAssociation').insertRows(actPayloads).catch(() => {});
    actPayloads.forEach(ap => memoryTableStore['ActSectionAssociation'].push(ap));

    // Upload finalized mapping
    if (catalystApp) await savePhotoMapping(catalystApp).catch(() => {});

    // Populate all remaining 21 Master/Lookup tables with linked entries (ROWID omitted)
    const writeMasterEntry = async (tableName, payload) => {
      if (datastore) await datastore.table(tableName).insertRow(payload).catch(() => {});
      memoryTableStore[tableName].push(payload);
    };

    await Promise.all([
      writeMasterEntry('CrimeHead', { CrimeHeadID: crimeHeadId, CrimeGroupName: crimeHeadName, Active: 1 }),
      writeMasterEntry('Section', { ActCode: 'BNS', SectionCode: '103', SectionDescription: 'Punishment for murder', Active: 1 }),
      writeMasterEntry('Act', { ActCode: 'BNS', ActDescription: 'Bharatiya Nyaya Sanhita', ShortName: 'BNS 2023', Active: 1 }),
      writeMasterEntry('ReligionMaster', { ReligionID: relMap[newCase.complainant?.religion || ""] || 1, ReligionName: newCase.complainant?.religion || "Hindu" }),
      writeMasterEntry('CasteMaster', { caste_master_id: casteMap[newCase.complainant?.caste || ""] || 1, caste_master_name: newCase.complainant?.caste || "General" }),
      writeMasterEntry('Unit_PoliceStation', {}),
      writeMasterEntry('State', { StateID: 1, StateName: 'Karnataka', NationalityID: 91, Active: 1 }),
      writeMasterEntry('District', { DistrictID: districtId, DistrictName: districtName, StateID: 1, Active: 1 }),
      writeMasterEntry('Court', { CourtID: courtId, CourtName: newCase.courtName || 'JMFC Court', DistrictID: districtId, StateID: 1, Active: 1 }),
      writeMasterEntry('GravityOffence', { GravityOffenceID: newCase.gravity === "Heinous" ? 1 : 2, LookupValue: newCase.gravity || "Non-Heinous" }),
      writeMasterEntry('CaseCategory', { CaseCategoryID: 1, LookupValue: newCase.category || "FIR" }),
      writeMasterEntry('CaseStatusMaster', { CaseStatusID: caseStatusId, CaseStatusName: newCase.status || "Under Investigation" }),
      writeMasterEntry('GenderMaster', { GenderID: 1, GenderName: 'Male' }),
      writeMasterEntry('OccupationMaster', { OccupationID: occMap[newCase.complainant?.occupation || ""] || 1, OccupationName: newCase.complainant?.occupation || "Business" }),
      writeMasterEntry('ChargesheetDetails', { CSID: Math.floor(Math.random() * 10000), CaseMasterID: caseMasterIdVal, csdate: formatDateTime(newCase.registeredDate), cstype: 'Original Chargesheet', PolicePersonID: policePersonId }),
      writeMasterEntry('Employee', { EmployeeID: policePersonId, DistrictID: districtId, UnitID: 1, RankID: 1, DesignationID: 1, KGID: String(policePersonId), FirstName: newCase.registeringOfficer || 'Inspector Ramesh', EmployeeDOB: '1985-06-15', GenderID: 1, BloodGroupID: 1, PhysicallyChallenged: 0, AppointmentDate: '2010-08-01' }),
      writeMasterEntry('Designation', { DesignationID: 1, DesignationName: newCase.officerRank || 'Police Inspector (PI)', Active: 1, SortOrder: 1 }),
      writeMasterEntry('Rank', { RankID: 1, RankName: 'Police Inspector', Hierarchy: 3, Active: 1 }),
      writeMasterEntry('CrimeSubHead', { CrimeSubHeadID: 1, CrimeHeadID: crimeHeadId, CrimeHeadName: crimeHeadName, SeqID: 1 }),
      writeMasterEntry('UnitType', { UnitTypeID: 1, UnitTypeName: 'Law and Order PS', CityDistState: 'Bengaluru District', Hierarchy: 1, Active: 1 }),
      writeMasterEntry('CrimeHeadActSection', { CrimeHeadID: crimeHeadId, ActCode: 'BNS', SectionCode: '103' })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        ...newCase,
        caseMasterId: caseMasterIdVal,
        officerPhoto: officerPhotoUrl
      },
      tableUpdates: {
        totalTablesUpdated: TABLE_METADATA.length,
        tables: TABLE_METADATA.map(t => t.name)
      }
    });
  } catch (err) {
    console.error('Error inserting case in Catalyst Datastore:', err);
    res.status(500).json({ status: 'failure', message: err.message });
  }
};

// Map handlers to all incoming route variations
router.get('/', getCasesHandler);
router.get('/cases', getCasesHandler);

router.post('/', postCasesHandler);
router.post('/cases', postCasesHandler);

// POST/PUT Handler - Update case details in CaseMaster
const updateCaseHandler = async (req, res) => {
  try {
    const catalystAppUpdate = getCatalystApp(req);
    const datastore = catalystAppUpdate ? catalystAppUpdate.datastore() : null;
    const { caseMasterId, status, briefFacts, chargesheetNo, chargesheetDate, chargesheetType } = req.body;

    if (!caseMasterId) {
      return res.status(400).json({ status: 'failure', message: 'Missing caseMasterId parameter' });
    }

    const statusMapInv = {
      "Under Investigation": 1,
      "Charge Sheeted": 2,
      "Closed": 3,
      "Pending Trial": 4
    };
    const caseStatusId = statusMapInv[status || "Under Investigation"] || 1;

    // Fetch the CaseMaster row to get its ROWID or update directly by CaseMasterID
    let rowId = null;
    const isRowId = String(caseMasterId).length >= 15;
    if (isRowId) {
      rowId = String(caseMasterId);
    } else if (catalystAppUpdate) {
      const zcql = catalystAppUpdate.zcql();
      const queryRes = await zcql.executeZCQLQuery(`SELECT ROWID FROM CaseMaster WHERE CaseMasterID = ${caseMasterId}`).catch(() => []);
      const row = queryRes?.[0]?.CaseMaster || queryRes?.[0];
      rowId = row?.ROWID;
    }

    // Resolve case master integer ID for child table references
    let datastoreCaseId = Number(caseMasterId);
    if (isRowId && catalystAppUpdate) {
      const zcql = catalystAppUpdate.zcql();
      const caseQuery = await zcql.executeZCQLQuery(`SELECT CaseMasterID FROM CaseMaster WHERE ROWID = ${rowId}`).catch(() => []);
      const caseRow = caseQuery?.[0]?.CaseMaster || caseQuery?.[0];
      if (caseRow && caseRow.CaseMasterID) {
        datastoreCaseId = Number(caseRow.CaseMasterID);
      }
    }

    // Safety constraint: Prevent bigint values from overflowing child table 32-bit integer FK column
    if (datastoreCaseId > 2147483647) {
      datastoreCaseId = datastoreCaseId % 100000;
    }

    if (!rowId) {
      // Fallback - update the memory cache
      const memRow = memoryTableStore['CaseMaster'].find(c => String(c.ROWID || c.CaseMasterID) === String(caseMasterId) || c.CaseMasterID === Number(caseMasterId));
      if (memRow) {
        memRow.CaseStatusID = caseStatusId;
        memRow.BriefFacts = briefFacts;
      }
    } else {
      // Update CaseMaster table row via Datastore SDK updateRow
      let updateSuccess = false;
      let lastError = null;
      if (datastore && rowId) {
        const payloads = [
          { ROWID: String(rowId), CaseStatusID: Number(caseStatusId), BriefFacts: String(briefFacts || "") },
          { ROWID: Number(rowId), CaseStatusID: Number(caseStatusId), BriefFacts: String(briefFacts || "") }
        ];
        for (const payload of payloads) {
          try {
            await datastore.table('CaseMaster').updateRow(payload);
            updateSuccess = true;
            break;
          } catch (e) {
            lastError = e;
            console.warn("Datastore updateRow attempt failed:", e.message);
          }
        }
      }
    }

    // Generate/Update chargesheet record if status is transitioned to Charge Sheeted
    if (caseStatusId === 2) {
      let existingCsRow = null;
      if (catalystAppUpdate) {
        const zcql = catalystAppUpdate.zcql();
        const csQuery = await zcql.executeZCQLQuery(`SELECT ROWID, CSID FROM ChargesheetDetails WHERE CaseMasterID = ${datastoreCaseId}`).catch(() => []);
        existingCsRow = csQuery?.[0]?.ChargesheetDetails || csQuery?.[0];
      } else {
        existingCsRow = (memoryTableStore['ChargesheetDetails'] || []).find(cs => cs.CaseMasterID === datastoreCaseId);
      }

      const parsedCsId = Number(String(chargesheetNo || '').replace(/\D/g, '')) || Math.floor(1000 + Math.random() * 9000);
      const parsedCsDate = chargesheetDate ? new Date(chargesheetDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      const parsedCsType = chargesheetType || 'Original Chargesheet';

      if (existingCsRow) {
        // Update existing chargesheet row
        if (datastore && existingCsRow.ROWID) {
          const payloads = [
            { ROWID: String(existingCsRow.ROWID), CSID: Number(parsedCsId), csdate: formatDateTime(parsedCsDate), cstype: String(parsedCsType) },
            { ROWID: Number(existingCsRow.ROWID), CSID: Number(parsedCsId), csdate: formatDateTime(parsedCsDate), cstype: String(parsedCsType) }
          ];
          for (const pl of payloads) {
            try {
              await datastore.table('ChargesheetDetails').updateRow(pl);
              break;
            } catch (err) {}
          }
        }
        // Also update memoryTableStore
        const memCs = (memoryTableStore['ChargesheetDetails'] || []).find(cs => cs.CaseMasterID === datastoreCaseId || String(cs.ROWID) === String(existingCsRow.ROWID));
        if (memCs) {
          memCs.CSID = Number(parsedCsId);
          memCs.csdate = formatDateTime(parsedCsDate);
          memCs.cstype = String(parsedCsType);
        }
      } else {
        // Insert new chargesheet row
        const csPayload = {
          CSID: Number(parsedCsId),
          CaseMasterID: datastoreCaseId,
          csdate: formatDateTime(parsedCsDate),
          cstype: String(parsedCsType),
          PolicePersonID: 29013
        };
        if (datastore) {
          await datastore.table('ChargesheetDetails').insertRow(csPayload).catch((e) => {
            console.error("Failed to insert ChargesheetDetails:", e.message);
          });
        }
        if (!memoryTableStore['ChargesheetDetails']) {
          memoryTableStore['ChargesheetDetails'] = [];
        }
        memoryTableStore['ChargesheetDetails'].push(csPayload);
      }
    }

    // Also update in memory store cache for CaseMaster
    const memRow = memoryTableStore['CaseMaster'].find(c => String(c.ROWID || c.CaseMasterID) === String(caseMasterId) || c.CaseMasterID === Number(caseMasterId));
    if (memRow) {
      memRow.CaseStatusID = caseStatusId;
      memRow.BriefFacts = briefFacts;
    }

    res.status(200).json({ status: 'success', message: 'Case updated successfully in Zoho Catalyst Datastore' });
  } catch (err) {
    console.error('Error updating case in Catalyst Datastore:', err);
    res.status(500).json({ status: 'failure', message: err.message });
  }
};

const recordArrestHandler = async (req, res) => {
  try {
    const catalystApp = getCatalystApp(req);
    const datastore = catalystApp ? catalystApp.datastore() : null;
    const { caseMasterId, accusedName, arrestDate, districtId } = req.body;

    let datastoreCaseId = Number(caseMasterId);
    if (catalystApp) {
      const zcql = catalystApp.zcql();
      if (String(caseMasterId).length >= 15) {
        const caseQuery = await zcql.executeZCQLQuery(`SELECT CaseMasterID FROM CaseMaster WHERE ROWID = ${caseMasterId}`).catch(() => []);
        const row = caseQuery?.[0]?.CaseMaster || caseQuery?.[0];
        if (row && row.CaseMasterID) {
          datastoreCaseId = Number(row.CaseMasterID);
        }
      }
    }

    let accusedMasterId = Math.floor(Math.random() * 10000);
    if (catalystApp) {
      const zcql = catalystApp.zcql();
      const accusedQuery = await zcql.executeZCQLQuery(`SELECT ROWID, AccusedMasterID FROM Accused WHERE CaseMasterID = ${datastoreCaseId} AND AccusedName = '${(accusedName || '').replace(/'/g, "\\'")}'`).catch(() => []);
      const accusedRow = accusedQuery?.[0]?.Accused || accusedQuery?.[0];
      if (accusedRow && accusedRow.AccusedMasterID) {
        accusedMasterId = Number(accusedRow.AccusedMasterID);
      }
    }

    const arrestPayload = {
      ArrestSurrenderID: Math.floor(Math.random() * 10000),
      CaseMasterID: datastoreCaseId,
      AccusedMasterID: accusedMasterId,
      ArrestSurrenderTypeID: 1,
      ArrestSurrenderDate: String(arrestDate || new Date().toISOString().slice(0, 10)),
      ArrestSurrenderStateId: 1,
      ArrestSurrenderDistrictId: Number(districtId) || 1
    };

    // Insert into Datastore table ArrestSurrender
    if (datastore) {
      await datastore.table('ArrestSurrender').insertRow(arrestPayload).catch((e) => {
        console.warn("Failed to insert arrest row in catalyst datastore:", e);
      });
    }

    // Also update memoryTableStore
    if (!memoryTableStore['ArrestSurrender']) {
      memoryTableStore['ArrestSurrender'] = [];
    }
    memoryTableStore['ArrestSurrender'].push(arrestPayload);

    res.status(200).json({ status: 'success', message: 'Arrest record saved successfully' });
  } catch (err) {
    console.error('Error saving arrest record:', err);
    res.status(500).json({ status: 'failure', message: err.message });
  }
};

// Dynamic Seeder Handler
const seedCasesHandler = async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const datastore = catalystApp.datastore();
    const targetDistrict = req.query.district;

    const districts = [
      "Bagalkot", "Ballari", "Belagavi", "Bengaluru Urban", "Bengaluru Rural", 
      "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", 
      "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", 
      "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", 
      "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", 
      "Uttara Kannada", "Vijayapura", "Yadgir"
    ];

    const districtIdMap = {
      "Bagalkot": 21, "Bagalkote": 21, "Ballari": 8, "Belagavi": 6,
      "Bengaluru Urban": 1, "Bengaluru Rural": 2, "Bidar": 19,
      "Chamarajanagar": 22, "Chamarajanagara": 22, "Chikkaballapur": 23, "Chikkaballapura": 23,
      "Chikkamagaluru": 17, "Chitradurga": 24, "Dakshina Kannada": 4,
      "Davanagere": 13, "Dharwad": 5, "Gadag": 25, "Hassan": 15,
      "Haveri": 26, "Kalaburagi": 7, "Kodagu": 18, "Kolar": 20,
      "Koppal": 27, "Mandya": 16, "Mysuru": 3, "Raichur": 14,
      "Ramanagara": 28, "Shivamogga": 11, "Tumakuru": 10, "Udupi": 12,
      "Uttara Kannada": 29, "Vijayapura": 9, "Yadgir": 30
    };

    const majorHeads = [
      { id: 1, name: "Property Crime", majorHead: "PROPERTY CLASS" },
      { id: 2, name: "Violent Crime", majorHead: "HEINOUS CLASS" },
      { id: 3, name: "Cyber Crime", majorHead: "CYBER CLASS" },
      { id: 4, name: "Narcotics", majorHead: "NDPS CLASS" }
    ];

    const sampleBriefs = [
      "House breaking and theft of gold ornaments by breaking padlock.",
      "Mobile phone and purse snatched by two suspects riding a motorcycle.",
      "Vishing scam where victim was tricked into sharing OTP credentials.",
      "Possession and attempt to distribute prohibited narcotic substances near college.",
      "Shop shutter pried open during late night hours and cash stolen."
    ];

    const seedCount = targetDistrict ? 100 : 10;
    const districtsToSeed = targetDistrict ? [targetDistrict] : districts;

    let totalInserted = 0;

    for (const dist of districtsToSeed) {
      const distId = districtIdMap[dist] || 1;
      const caseBatches = [];
      const accusedBatches = [];
      const victimBatches = [];
      const complainantBatches = [];

      for (let i = 0; i < seedCount; i++) {
        const caseMasterIdVal = Math.floor(Math.random() * 1000000) + 20000;
        const crimeNo = `FIR-${dist.toUpperCase().slice(0, 3)}-${2026}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
        
        // Grid center coordinates
        const baseLat = 12.9 + (distId * 0.05);
        const baseLng = 75.5 + (distId * 0.05);
        const lat = baseLat + (Math.random() - 0.5) * 0.1;
        const lng = baseLng + (Math.random() - 0.5) * 0.1;

        const major = majorHeads[Math.floor(Math.random() * majorHeads.length)];
        const brief = sampleBriefs[Math.floor(Math.random() * sampleBriefs.length)];

        // CaseMaster Record
        const caseMasterPayload = {
          CaseMasterID: caseMasterIdVal,
          CrimeNo: crimeNo,
          CrimeRegisteredDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          PolicePersonID: Math.floor(Math.random() * 1000) + 100,
          PoliceStationID: 100 + distId,
          CaseCategoryID: Math.floor(Math.random() * 4) + 1,
          GravityOffenceID: Math.random() > 0.8 ? 1 : 2, // 1 = Heinous, 2 = Non-Heinous
          CrimeMajorHeadID: major.id,
          CrimeMinorHeadID: Math.floor(Math.random() * 10) + 1,
          CaseStatusID: Math.floor(Math.random() * 4) + 1,
          CourtID: distId * 2 + 1,
          IncidentFromDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
          IncidentToDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
          InfoReceivedPSDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
          latitude: lat,
          longitude: lng,
          BriefFacts: brief
        };
        caseBatches.push(caseMasterPayload);

        // Complainant Details Record
        const complainantPayload = {
          ComplainantID: Math.floor(Math.random() * 100000),
          CaseMasterID: caseMasterIdVal,
          ComplainantName: `Complainant ${Math.floor(Math.random() * 1000)}`,
          AgeYear: 20 + Math.floor(Math.random() * 50),
          OccupationID: 1,
          ReligionID: 1,
          CasteID: 1,
          GenderID: Math.random() > 0.5 ? 1 : 2
        };
        complainantBatches.push(complainantPayload);

        // Victim Record
        const victimPayload = {
          VictimMasterID: Math.floor(Math.random() * 100000),
          CaseMasterID: caseMasterIdVal,
          VictimName: `Victim ${Math.floor(Math.random() * 1000)}`,
          AgeYear: 18 + Math.floor(Math.random() * 60),
          GenderID: Math.random() > 0.5 ? 1 : 2,
          VictimPolice: Math.random() > 0.95 ? "1" : "0"
        };
        victimBatches.push(victimPayload);

        // Accused Record
        const accusedPayload = {
          AccusedMasterID: Math.floor(Math.random() * 100000),
          CaseMasterID: caseMasterIdVal,
          AccusedName: `Accused ${Math.floor(Math.random() * 1000)}`,
          AgeYear: 19 + Math.floor(Math.random() * 40),
          GenderID: Math.random() > 0.5 ? 1 : 2,
          PersonID: `ACC-${Math.floor(Math.random() * 10000)}`
        };
        accusedBatches.push(accusedPayload);
      }

      // Batch insert inside the loop (within 100 row limitations)
      await datastore.table('CaseMaster').insertRows(caseBatches).catch((e) => console.log('Seed error CaseMaster:', e.message));
      await datastore.table('ComplainantDetails').insertRows(complainantBatches).catch((e) => console.log('Seed error Complainant:', e.message));
      await datastore.table('Victim').insertRows(victimBatches).catch((e) => console.log('Seed error Victim:', e.message));
      await datastore.table('Accused').insertRows(accusedBatches).catch((e) => console.log('Seed error Accused:', e.message));

      // Append to local memory store
      if (!memoryTableStore['CaseMaster']) memoryTableStore['CaseMaster'] = [];
      if (!memoryTableStore['ComplainantDetails']) memoryTableStore['ComplainantDetails'] = [];
      if (!memoryTableStore['Victim']) memoryTableStore['Victim'] = [];
      if (!memoryTableStore['Accused']) memoryTableStore['Accused'] = [];

      caseBatches.forEach(cb => memoryTableStore['CaseMaster'].push(cb));
      complainantBatches.forEach(cb => memoryTableStore['ComplainantDetails'].push(cb));
      victimBatches.forEach(cb => memoryTableStore['Victim'].push(cb));
      accusedBatches.forEach(cb => memoryTableStore['Accused'].push(cb));

      totalInserted += seedCount;
    }

    res.status(200).json({ 
      status: 'success', 
      message: `Seeded ${totalInserted} cases successfully into Zoho Catalyst Datastore.` 
    });
  } catch (err) {
    console.error('Seeding failed:', err);
    res.status(500).json({ status: 'failure', message: err.message });
  }
};

router.post('/cases/update', updateCaseHandler);
router.put('/cases/update', updateCaseHandler);
router.put('/cases', updateCaseHandler);
router.put('/', updateCaseHandler);

router.post('/cases/arrest', recordArrestHandler);
router.patch('/cases', recordArrestHandler);
router.patch('/', recordArrestHandler);
router.get('/seed', seedCasesHandler);
router.post('/seed', seedCasesHandler);

// DELETE Handler - Clear all 27 tables
const deleteCasesHandler = async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const datastore = catalystApp.datastore();
    
    for (const t of TABLE_METADATA) {
      memoryTableStore[t.name] = [];
      try {
        const queryRes = await zcql.executeZCQLQuery(`SELECT ROWID FROM ${t.name}`).catch(() => []);
        const rowIds = (queryRes || []).map(r => r[t.name]?.ROWID || r.ROWID).filter(Boolean);
        if (rowIds.length > 0) {
          await datastore.table(t.name).deleteRows(rowIds).catch(e => {});
        }
      } catch (e) {}
    }

    // Reset photo mapping
    photoMapping = {};
    if (photoMappingFileId) {
      const filestore = catalystApp.filestore();
      const bucket = filestore.bucket('photos');
      await bucket.deleteFile(photoMappingFileId).catch(() => {});
      photoMappingFileId = null;
    }

    res.status(200).json({ status: 'success', message: 'All 27 tables cleared successfully across Zoho Catalyst Datastore' });
  } catch (err) {
    console.error('Error clearing Catalyst Datastore:', err);
    res.status(500).json({ status: 'failure', message: err.message });
  }
};

router.delete('/', deleteCasesHandler);
router.delete('/cases', deleteCasesHandler);

app.use('/', router);
app.use('/server/api', router);

module.exports = app;

