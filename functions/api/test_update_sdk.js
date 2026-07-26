const catalyst = require('zcatalyst-sdk-node');
const app = catalyst.initialize();

async function run() {
  try {
    const datastore = app.datastore();
    const zcql = app.zcql();

    console.log("Querying CaseMaster row...");
    const queryRes = await zcql.executeZCQLQuery("SELECT ROWID, CaseMasterID, CaseStatusID FROM CaseMaster LIMIT 1").catch(() => []);
    if (!queryRes || queryRes.length === 0) {
      console.log("No cases found in CaseMaster");
      return;
    }

    const caseRow = queryRes[0].CaseMaster || queryRes[0];
    const rowId = caseRow.ROWID;
    console.log(`Found row: CaseMasterID=${caseRow.CaseMasterID}, ROWID=${rowId}, current CaseStatusID=${caseRow.CaseStatusID}`);

    const nextStatus = caseRow.CaseStatusID === 2 ? 1 : 2;
    console.log(`Attempting to update status to ${nextStatus}...`);

    const payload = {
      ROWID: String(rowId),
      CaseStatusID: nextStatus,
      BriefFacts: "Updated via diagnostic test"
    };

    console.log("Calling updateRow with string ROWID...");
    try {
      const res = await datastore.table('CaseMaster').updateRow(payload);
      console.log("SUCCESS! updateRow returned:", res);
    } catch (err) {
      console.error("String ROWID update failed:", err.message);

      console.log("Calling updateRow with numeric ROWID...");
      try {
        const payload2 = { ...payload, ROWID: Number(rowId) };
        const res2 = await datastore.table('CaseMaster').updateRow(payload2);
        console.log("SUCCESS with numeric ROWID! updateRow returned:", res2);
      } catch (err2) {
        console.error("Numeric ROWID update failed:", err2.message);
      }
    }
  } catch (err) {
    console.error("Main execution failed:", err.message);
  }
}

run();
