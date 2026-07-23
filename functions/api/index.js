const express = require('express');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(express.json());

const router = express.Router();

function getDatastore(req) {
  const catalystApp = catalyst.initialize(req);
  return catalystApp.datastore();
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

// Health check / root endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'KSP Crime Intelligence Catalyst Serverless API is online and active.'
  });
});

// GET Handler - Fetch all case records with related child tables using ZCQL
const getCasesHandler = async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const fetchTableZCQL = async (tableName) => {
      try {
        const queryRes = await zcql.executeZCQLQuery(`SELECT * FROM ${tableName}`);
        return (queryRes || []).map(r => r[tableName] || r);
      } catch (err) {
        console.warn(`Warning ZCQL fetching table ${tableName}:`, err.message);
        return [];
      }
    };

    const [normalizedCases, accusedRows, victimRows, complainantRows, arrestRows, actRows] = await Promise.all([
      fetchTableZCQL('CaseMaster'),
      fetchTableZCQL('Accused'),
      fetchTableZCQL('Victim'),
      fetchTableZCQL('ComplainantDetails'),
      fetchTableZCQL('ArrestSurrender'),
      fetchTableZCQL('ActSectionAssociation')
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        cases: normalizedCases,
        accused: accusedRows,
        victims: victimRows,
        complainants: complainantRows,
        arrests: arrestRows,
        actSections: actRows
      }
    });
  } catch (err) {
    console.error('Error fetching cases from Catalyst Datastore via ZCQL:', err);
    res.status(500).json({ status: 'failure', message: err.message });
  }
};

// POST Handler - Insert a complete case with complainant, victims, accused, arrest, and act sections
const postCasesHandler = async (req, res) => {
  try {
    const datastore = getDatastore(req);
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

    // Build CaseMaster payload
    const caseMasterPayload = {
      CaseMasterID: caseMasterIdVal,
      CrimeNo: String(newCase.crimeNo),
      CrimeRegisteredDate: formatDateOnly(newCase.registeredDate),
      PolicePersonID: policePersonId,
      PoliceStationID: 100 + (newCase.district?.id || 1),
      CaseCategoryID: newCase.category === "FIR" ? 1 : newCase.category === "UDR" ? 3 : newCase.category === "Zero FIR" ? 8 : 4,
      GravityOffenceID: newCase.gravity === "Heinous" ? 1 : 2,
      CrimeMajorHeadID: newCase.crimeHead?.id || 1,
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
    try {
      insertedCaseRow = await datastore.table('CaseMaster').insertRow(caseMasterPayload);
    } catch (insertErr) {
      console.warn("Full CaseMaster insert failed, retrying with core payload:", insertErr.message);
      const minimalPayload = {
        CrimeNo: String(newCase.crimeNo),
        CrimeRegisteredDate: formatDateOnly(newCase.registeredDate),
        PolicePersonID: policePersonId,
        PoliceStationID: 100 + (newCase.district?.id || 1),
        CaseCategoryID: 1,
        GravityOffenceID: 1,
        CrimeMajorHeadID: 1,
        CaseStatusID: 1,
        BriefFacts: String(newCase.briefFacts || "Case registered.")
      };
      insertedCaseRow = await datastore.table('CaseMaster').insertRow(minimalPayload);
    }

    const insertedCaseObj = insertedCaseRow?.CaseMaster || insertedCaseRow;
    const numericRowId = Number(insertedCaseObj?.ROWID || insertedCaseObj?.CaseMasterID || caseMasterIdVal);

    // 2. Insert ComplainantDetails
    if (newCase.complainant) {
      await datastore.table('ComplainantDetails').insertRow({
        CaseMasterID: numericRowId,
        ComplainantName: String(newCase.complainant.name),
        AgeYear: Number(newCase.complainant.age) || 30,
        GenderID: genderMap[newCase.complainant.gender] || 1,
        OccupationID: occMap[newCase.complainant.occupation] || 7,
        ReligionID: relMap[newCase.complainant.religion || ""] || 7,
        CasteID: casteMap[newCase.complainant.caste || ""] || 1
      }).catch(e => console.error("Complainant insert warning:", e.message));
    }

    // 3. Insert Victims
    if (newCase.victims && newCase.victims.length > 0) {
      const victimsPayload = newCase.victims.map(v => ({
        CaseMasterID: numericRowId,
        VictimName: String(v.name),
        AgeYear: Number(v.age) || 25,
        GenderID: genderMap[v.gender] || 1,
        VictimPolice: v.isPolice ? "1" : "0"
      }));
      await datastore.table('Victim').insertRows(victimsPayload).catch(e => console.error("Victim insert warning:", e.message));
    }

    // 4. Insert Accused & ArrestSurrender
    if (newCase.accused && newCase.accused.length > 0) {
      const accusedPayload = newCase.accused.map(a => ({
        CaseMasterID: numericRowId,
        AccusedName: String(a.name),
        AgeYear: Number(a.age) || 30,
        GenderID: genderMap[a.gender] || 1,
        PersonID: String(a.id || "A1")
      }));

      const insertedAccusedRows = await datastore.table('Accused').insertRows(accusedPayload).catch(e => console.error("Accused insert error:", e.message));
      const rawRows = Array.isArray(insertedAccusedRows) ? insertedAccusedRows : (insertedAccusedRows ? [insertedAccusedRows] : []);
      const accRows = rawRows.map(r => r?.Accused || r);

      const arrestPayload = [];
      newCase.accused.forEach((a, idx) => {
        if (a.arrestId || a.arrestDate) {
          const createdAccusedRow = accRows[idx];
          const accusedMasterId = Number(createdAccusedRow?.ROWID || createdAccusedRow?.AccusedMasterID || (idx + 1));
          if (accusedMasterId) {
            const ioMatch = String(a.ioName || "").match(/\d+/);
            const ioId = ioMatch ? Number(ioMatch[0]) : 1;
            arrestPayload.push({
              CaseMasterID: numericRowId,
              AccusedMasterID: accusedMasterId,
              ArrestSurrenderTypeID: 1,
              ArrestSurrenderDate: formatDateOnly(a.arrestDate),
              ArrestSurrenderDistrictId: newCase.district?.id || 1,
              PoliceStationID: 100 + (newCase.district?.id || 1),
              IOID: ioId,
              CourtID: courtMap[a.courtName || ""] || 1,
              IsAccused: true,
              IsComplainantAccused: false
            });
          }
        }
      });

      if (arrestPayload.length > 0) {
        await datastore.table('ArrestSurrender').insertRows(arrestPayload).catch(e => console.error("Arrest insert warning:", e.message));
      }
    }

    // 5. Insert ActSectionAssociation
    if (newCase.actSections && newCase.actSections.length > 0) {
      const actPayload = newCase.actSections.map((sec, idx) => {
        const parts = String(sec).split(/\s+/);
        const actCode = parts[0] || "BNS";
        const secCode = parts[1] || "103";
        return {
          CaseMasterID: numericRowId,
          ActID: actCode === "BNS" ? 1 : actCode === "IPC" ? 2 : 3,
          SectionID: Number(secCode.replace(/\D/g, "")) || 103,
          ActOrderID: idx + 1,
          SectionOrderID: idx + 1
        };
      });
      await datastore.table('ActSectionAssociation').insertRows(actPayload).catch(e => console.error("ActSection insert warning:", e.message));
    }

    res.status(200).json({
      status: 'success',
      data: {
        ...newCase,
        caseMasterId: numericRowId
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

// DELETE Handler - Clear all rows
const deleteCasesHandler = async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const datastore = catalystApp.datastore();
    const tables = ['ActSectionAssociation', 'ArrestSurrender', 'Victim', 'Accused', 'ComplainantDetails', 'CaseMaster'];
    
    for (const tName of tables) {
      const queryRes = await zcql.executeZCQLQuery(`SELECT ROWID FROM ${tName}`).catch(() => []);
      const rowIds = (queryRes || []).map(r => r[tName]?.ROWID || r.ROWID).filter(Boolean);
      if (rowIds.length > 0) {
        await datastore.table(tName).deleteRows(rowIds).catch(e => console.error(e.message));
      }
    }

    res.status(200).json({ status: 'success', message: 'All tables cleared successfully' });
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
