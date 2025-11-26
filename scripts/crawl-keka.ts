/**
 * Crawl script for Keka public website pages
 * Generates docs.index.json with chunked content and stub embeddings
 */

import fs from 'fs';
import path from 'path';

// Stub pages - in production, these would be crawled from the actual website
const KEKA_PAGES = [
  {
    url: 'https://kekarehabservices.com/about-us/',
    title: 'About Keka Rehab Services',
    content: `Keka Rehab Services is a Boston-based organization providing comprehensive rehabilitation and home care services.
    We serve patients, families, and caregivers with personalized therapy, skilled nursing, and community programs.
    Our mission is to promote independence, wellness, and quality of life through evidence-based care and compassionate support.`,
  },
  {
    url: 'https://kekarehabservices.com/what-we-do/',
    title: 'What We Do - Therapy Services',
    content: `Keka provides physical therapy, occupational therapy, and speech therapy for adults and children.
    Services are delivered in-home, in clinic, or at our Adult Day Health Center. We offer stroke recovery programs,
    fall prevention, pain management, and wellness classes designed to help seniors maintain independence.`,
  },
  {
    url: 'https://kekarehabservices.com/health-hub/',
    title: 'Health Hub - Wellness Resources',
    content: `The Keka Health Hub offers educational resources, wellness tips, and community programs.
    We provide workshops on fall prevention, caregiver support groups, exercise classes, and health screenings.
    Our goal is to empower individuals and families with knowledge and tools for healthy aging.`,
  },
  {
    url: 'https://kekarehabservices.com/keka-shop/',
    title: 'Keka Shop - Marketplace',
    content: `Our marketplace connects you with trusted vendors for medical equipment, home care supplies, transportation,
    meal delivery, and other supportive services. We offer pain relief creams, mobility aids, and Keka merchandise.
    Products are carefully chosen to complement our services and support daily living.`,
  },
  {
    url: 'https://kekarehabservices.com/referral-form/',
    title: 'Submit a Referral',
    content: `Submit a referral for therapy or home care services. We accept referrals from physicians, hospitals,
    and families. Our intake team will verify insurance, conduct an assessment, and create a personalized care plan.
    Contact us at (617) 427-8494 to discuss your needs.`,
  },
  {
    url: 'https://kekarehabservices.com/staffing/',
    title: 'Staffing Services',
    content: `Keka provides staffing solutions for agencies seeking licensed therapists, nurses, and caregivers.
    We carefully match professionals with agencies based on skills and patient needs.`,
  },
  {
    url: 'https://kekarehabservices.com/partnership/',
    title: 'Partnership Opportunities',
    content: `We consult on CHAP accreditation and help agencies launch or scale their operations.
    Our partnership approach prioritizes quality, continuity, and compliance.`,
  },
  {
    url: 'https://kekarehabservices.com/contact-us/',
    title: 'Contact Us',
    content: `Reach Keka Rehab Services at (617) 427-8494 or visit our office in Boston.
    Office hours: Monday-Friday, 9:00 AM - 5:00 PM. For emergencies, call 911.
    We accept Medicare, Medi-Cal, and most major insurance plans.`,
  },
];

// Chunk text into ~300 token sections
function chunkText(text: string, maxLength: number = 300): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  for (const word of words) {
    currentChunk.push(word);
    if (currentChunk.join(' ').length >= maxLength) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

// Generate stub embeddings (1536 dimensions, all zeros)
// In production, call Azure OpenAI or AWS Bedrock embedding service
function generateStubEmbedding(): number[] {
  return new Array(1536).fill(0);
}

// Main crawl function
async function crawl() {
  console.log('🔍 Crawling Keka website pages...');

  const documents = [];

  for (const page of KEKA_PAGES) {
    console.log(`  Chunking: ${page.title}`);

    const chunks = chunkText(page.content, 300);

    for (let i = 0; i < chunks.length; i++) {
      const doc = {
        id: `${page.url}#chunk-${i}`,
        title: `${page.title} (Part ${i + 1})`,
        url: page.url,
        content: chunks[i],
        embedding: generateStubEmbedding(),
      };

      documents.push(doc);
    }
  }

  // Create output directory
  const dataDir = path.join(__dirname, '../backend/data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write to docs.index.json
  const outputPath = path.join(dataDir, 'docs.index.json');
  const index = {
    documents,
    last_updated: new Date().toISOString(),
  };

  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2));

  console.log(`\n✅ Created docs index with ${documents.length} documents`);
  console.log(`📝 Output: ${outputPath}`);
  console.log('\n💡 Next steps:');
  console.log('  1. To use real embeddings, integrate Azure OpenAI or AWS Bedrock');
  console.log('  2. Update AZURE_OPENAI_* env vars in .env');
  console.log('  3. Modify generateStubEmbedding() to call embedding service');
}

// Run crawler
crawl().catch((error) => {
  console.error('❌ Crawler error:', error);
  process.exit(1);
});
