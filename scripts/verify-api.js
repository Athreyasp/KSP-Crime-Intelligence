const BASE_URL = "https://ksp-60078060929.development.catalystserverless.in/server/api";

async function verifyAPI() {
  console.log("==================================================");
  console.log("STEP 1: Testing Root / Health Check (GET)");
  console.log("==================================================");
  try {
    const rootRes = await fetch(`${BASE_URL}/`);
    console.log(`HTTP Status: ${rootRes.status}`);
    const rootText = await rootRes.text();
    console.log(`Response: ${rootText}`);
  } catch (err) {
    console.error("Root GET failed:", err.message);
  }

  console.log("\n==================================================");
  console.log("STEP 2: Fetching Existing Cases (GET /cases)");
  console.log("==================================================");
  try {
    const getRes = await fetch(`${BASE_URL}/cases`);
    console.log(`HTTP Status: ${getRes.status}`);
    const getText = await getRes.text();
    console.log(`Response: ${getText.substring(0, 300)}...`);
  } catch (err) {
    console.error("Cases GET failed:", err.message);
  }

  console.log("\n==================================================");
  console.log("STEP 3: Inserting New Test Case Record (POST /cases)");
  console.log("==================================================");
  const testPayload = {
    crimeNo: `B${Math.floor(1000 + Math.random() * 9000)}-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    registeredDate: "2026-07-23",
    incidentDate: "2026-07-23T14:30:00",
    district: { id: 1, name: "Bengaluru City" },
    category: "FIR",
    gravity: "Heinous",
    crimeHead: { id: 1, name: "Murder" },
    status: "Under Investigation",
    courtName: "JMFC Court",
    briefFacts: "Automated test case record inserted via POST method to verify end-to-end connectivity.",
    latitude: 12.9716,
    longitude: 77.5946,
    complainant: {
      name: "Verification Officer",
      age: 38,
      gender: "M",
      occupation: "Government Employee",
      religion: "Hindu",
      caste: "General"
    },
    victims: [
      { name: "Victim Test 1", age: 30, gender: "F", isPolice: false }
    ],
    accused: [
      { id: "ACC-99", name: "Accused Test 1", age: 29, gender: "M", arrestDate: "2026-07-23" }
    ],
    actSections: ["BNS 103", "BNS 302"]
  };

  let insertedId = null;
  try {
    const postRes = await fetch(`${BASE_URL}/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload)
    });
    console.log(`HTTP Status: ${postRes.status}`);
    const postJson = await postRes.json();
    console.log("POST Response:", JSON.stringify(postJson, null, 2));
    if (postJson.status === "success") {
      insertedId = postJson.data?.caseMasterId;
      console.log(`SUCCESS: Case inserted with caseMasterId = ${insertedId}`);
    }
  } catch (err) {
    console.error("Cases POST failed:", err.message);
  }

  console.log("\n==================================================");
  console.log("STEP 4: Verifying Data Record is Reflecting (GET /cases)");
  console.log("==================================================");
  try {
    const getRes2 = await fetch(`${BASE_URL}/cases`);
    console.log(`HTTP Status: ${getRes2.status}`);
    const getJson2 = await getRes2.json();
    if (getJson2.status === "success" && getJson2.data?.cases) {
      const casesList = getJson2.data.cases;
      console.log(`Total records in Datastore: ${casesList.length}`);
      const found = casesList.find(c => c.CrimeNo === testPayload.crimeNo || c.CaseMasterID === insertedId);
      if (found) {
        console.log("✅ VERIFICATION SUCCESSFUL! Inserted record reflected in GET /cases:");
        console.log(JSON.stringify(found, null, 2));
      } else {
        console.log("⚠️ Inserted record not found in returned cases list.");
      }
    } else {
      console.log("GET /cases response:", getJson2);
    }
  } catch (err) {
    console.error("Verification GET failed:", err.message);
  }
}

verifyAPI();
