import assert from "node:assert/strict";
import { deriveSeniority, deriveDepartment } from "./job-title";

// Seniority: the most senior signal in the title wins.
{
  assert.equal(deriveSeniority("CEO"), "c_level", "a bare CEO is C-level; only founder/owner wording is 'owner'");
  assert.equal(deriveSeniority("Chief Technology Officer"), "c_level");
  assert.equal(deriveSeniority("CTO"), "c_level");
  assert.equal(deriveSeniority("Co-Founder & CEO"), "owner");
  assert.equal(deriveSeniority("VP of Engineering"), "vp");
  // Regression: bare /president/ used to match inside "Vice President" and mis-rank it c_level.
  assert.equal(deriveSeniority("Senior Vice President, Sales"), "vp", "VP outranks the 'Senior' prefix");
  assert.equal(deriveSeniority("Vice President of Product"), "vp");
  assert.equal(deriveSeniority("SVP Engineering"), "vp");
  assert.equal(deriveSeniority("President"), "c_level", "a standalone President is still C-level");
  assert.equal(deriveSeniority("Director of Marketing"), "director");
  assert.equal(deriveSeniority("Head of People"), "head");
  assert.equal(deriveSeniority("Engineering Manager"), "manager");
  assert.equal(deriveSeniority("Senior Software Engineer"), "senior");
  assert.equal(deriveSeniority("Software Engineer"), "entry", "classifiable but unranked = IC");
}

// Unknown or empty input must stay null, never a guess.
{
  assert.equal(deriveSeniority(null), null);
  assert.equal(deriveSeniority(""), null);
  assert.equal(deriveSeniority("   "), null);
  assert.equal(deriveSeniority("Astronaut"), null, "unclassifiable title stays null, not 'entry'");
  assert.equal(deriveDepartment("Astronaut"), null);
  assert.equal(deriveDepartment(null), null);
}

// Department: C-suite initialisms carry their own function.
{
  assert.equal(deriveDepartment("CTO"), "engineering");
  assert.equal(deriveDepartment("CFO"), "finance");
  assert.equal(deriveDepartment("CMO"), "marketing");
  assert.equal(deriveDepartment("CRO"), "sales");
  assert.equal(deriveDepartment("CEO"), "executive", "CEO runs the company, not a function");
  assert.equal(deriveDepartment("Founder"), "executive");
}

// Department: generic keyword routing.
{
  assert.equal(deriveDepartment("Account Executive"), "sales");
  assert.equal(deriveDepartment("SDR"), "sales");
  assert.equal(deriveDepartment("Head of Growth"), "marketing");
  assert.equal(deriveDepartment("Staff Software Engineer"), "engineering");
  assert.equal(deriveDepartment("Product Designer"), "product");
  assert.equal(deriveDepartment("Financial Controller"), "finance");
  assert.equal(deriveDepartment("Talent Acquisition Partner"), "hr");
  assert.equal(deriveDepartment("General Counsel"), "legal");
  assert.equal(deriveDepartment("Customer Success Manager"), "support");
  assert.equal(deriveDepartment("Supply Chain Manager"), "operations");
}

// Casing and punctuation must not change the outcome.
{
  assert.equal(deriveSeniority("  vp,  sales  "), "vp");
  assert.equal(deriveDepartment("V.P. of Sales"), "sales");
  assert.equal(deriveSeniority("SR. DEVELOPER"), "senior");
}

// The pair used at write time stays consistent with the individual derivations.
{
  const title = "VP of Finance";
  assert.equal(deriveSeniority(title), "vp");
  assert.equal(deriveDepartment(title), "finance");
}

console.log("job-title: all assertions passed");
