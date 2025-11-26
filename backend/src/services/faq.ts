import { BotResponse, Button } from '../types/schema';

export interface FAQCategory {
  id: string;
  emoji: string;
  label: string;
  questions: FAQQuestion[];
}

export interface FAQQuestion {
  id: string;
  question: string;
  answer: string;
  links?: Array<{ title: string; url: string; description?: string }>;
}

// Top-level menu categories
export const TOP_LEVEL_MENU: Button[] = [
  { label: '🏥 Patient / Client Intake', value: 'start_patient_intake' },
  { label: '📊 Accreditation & Consulting', value: 'start_accreditation_intake' },
  { label: '👩🏾‍⚕️ Staffing & Employment', value: 'start_staffing_intake' },
  { label: 'Therapy & Rehabilitation', value: 'therapy_rehab' },
  { label: 'Home Care & Staffing', value: 'home_care' },
  { label: 'Business & Agency Support', value: 'business' },
  { label: 'Access, Insurance & Billing', value: 'insurance' },
  { label: 'Equipment & Home Safety', value: 'equipment' },
  { label: 'Community & E-Commerce', value: 'community' },
  { label: 'Speak to a Human', value: 'contact_me' },
  { label: 'Something Else', value: 'something_else' },
];

// FAQ content for each category
export const FAQ_CATEGORIES: Record<string, FAQCategory> = {
  therapy_rehab: {
    id: 'therapy_rehab',
    emoji: '🏥',
    label: 'Therapy & Rehabilitation',
    questions: [
      {
        id: 'therapy_types',
        question: 'What therapy types do you provide?',
        answer: 'We provide a full spectrum of physical, occupational, and speech therapy tailored to the needs of older adults. Our physical therapy programs restore mobility, improve balance, and reduce pain. Occupational therapy helps with everyday living skills, from dressing and cooking to using adaptive equipment. Speech therapy supports communication challenges and swallowing disorders. Each plan is developed using evidence-based outcome measures and personalized to your unique goals.',
        links: [
          {
            title: 'Our Therapy Services',
            url: 'https://kekarehabservices.com/what-we-do/',
            description: 'Learn more about our programs',
          },
        ],
      },
      {
        id: 'therapy_location',
        question: 'Can you provide therapy at home?',
        answer: 'Yes. We understand that not every patient can easily travel to a clinic, so we bring therapy directly to you. Our therapists provide care in the comfort of your home, especially valuable for seniors managing mobility or transportation challenges. We also deliver therapy at Adult Day Health (ADH) programs, where services are integrated into structured daily routines to promote engagement and socialization.',
      },
      {
        id: 'specialized_programs',
        question: 'Do you offer specialized programs?',
        answer: 'Yes. Our therapists regularly design specialized rehabilitation programs for common challenges faced by older adults. Stroke recovery programs focus on regaining movement, coordination, and communication. For fall prevention, we combine strength training, balance exercises, and home safety education. For chronic pain, we provide non-invasive approaches such as targeted exercise, manual therapy, and wellness education.',
        links: [
          {
            title: 'Health Hub',
            url: 'https://kekarehabservices.com/health-hub/',
            description: 'Wellness resources',
          },
        ],
      },
      {
        id: 'wellness_classes',
        question: 'Do you provide wellness classes?',
        answer: 'Yes. Beyond rehabilitation for specific conditions, we promote preventive wellness and healthy aging through exercise programs and wellness education. These programs help seniors build strength, maintain flexibility, and prevent common issues such as falls or joint stiffness. They support independence by keeping patients active and engaged in daily life.',
      },
    ],
  },
  home_care: {
    id: 'home_care',
    emoji: '🩺',
    label: 'Home Care & Staffing',
    questions: [
      {
        id: 'disability_care',
        question: 'Do you provide disability care?',
        answer: 'Yes. In addition to therapy, we provide skilled caregivers, nurses, and licensed therapists who are trained to work with individuals living with disabilities. Services are tailored to each person\'s physical, cognitive, and medical needs, ensuring dignity and independence are supported at every stage. We focus on matching patients with caregivers and therapists who understand their specific challenges, whether those are mobility limitations, developmental conditions, or complex health needs.',
        links: [
          {
            title: 'Staffing Services',
            url: 'https://kekarehabservices.com/staffing/',
            description: 'Professional care teams',
          },
        ],
      },
      {
        id: 'dementia_care',
        question: 'Do you provide dementia care?',
        answer: 'Yes. We recognize that memory care requires a specialized approach, and our caregivers and therapists are trained to work with individuals living with dementia or Alzheimer\'s disease. Care plans focus on maintaining familiar routines, promoting safety in the home, and engaging patients in activities that support cognitive and physical function. Families benefit from peace of mind knowing their loved one is cared for by professionals who are patient, compassionate, and experienced in dementia care.',
      },
      {
        id: 'staff_qualifications',
        question: 'What are staff qualifications?',
        answer: 'All of our therapists are licensed professionals in their fields — physical therapists, occupational therapists, and speech-language pathologists — with advanced training and certification. Caregivers also undergo specialized training in elder care, dementia support, and infection control to ensure safe, high-quality service. Staff qualifications are thoroughly vetted through background checks and license verification, ensuring that families can trust the professionals entering their homes.',
      },
      {
        id: 'same_caregiver',
        question: 'Can I request the same caregiver?',
        answer: 'Yes. We understand that continuity of care builds trust and comfort, especially for seniors and families. Whenever scheduling allows, we make every effort to assign the same caregiver or therapist for each visit. This ensures that staff are familiar with the patient\'s routines, preferences, and care plan, minimizing disruptions and creating a sense of stability. Our philosophy is rooted in patient-focused care, and keeping the same caregiver is one way we uphold that promise.',
      },
      {
        id: 'safety_screening',
        question: 'How do you ensure caregiver safety?',
        answer: 'All caregivers and therapists undergo a comprehensive screening process before joining our team. This includes background checks, credential verification, and health screenings to ensure that only qualified and trustworthy professionals are placed with patients. Safety is a core part of our patient-centered approach, and families can feel confident knowing that every staff member has been carefully vetted. The Health Hub consistently emphasizes "trusted, professional care," and our screening process is one of the ways we uphold that standard.',
      },
      {
        id: 'infection_control',
        question: 'How do you prevent illness spread?',
        answer: 'We follow strict infection control protocols to protect both patients and caregivers. These include proper hand hygiene, use of personal protective equipment when necessary, sanitization of equipment, and ongoing training in best practices for reducing the spread of illness. Staff are monitored for symptoms and are not permitted to provide in-home care if they are unwell. These steps are especially important for older adults and those with compromised immune systems, and they reflect our commitment to providing safe, high-quality care in every setting.',
      },
    ],
  },
  equipment: {
    id: 'equipment',
    emoji: '🛠️',
    label: 'Equipment & Home Safety',
    questions: [
      {
        id: 'medical_equipment',
        question: 'Can you help me get medical equipment?',
        answer: 'Yes. Our therapists and care team can guide you in selecting the right mobility aids and durable medical equipment to support independence at home. Whether you need a walker to improve balance, a wheelchair for safe mobility, or other adaptive devices to make daily tasks easier, we will help you identify options that meet your specific needs. We also connect families with trusted suppliers so equipment is reliable and affordable. Once equipment is delivered, our therapists can demonstrate safe use, offer tips for daily routines, and ensure proper fit.',
        links: [
          {
            title: 'Equipment Marketplace',
            url: 'https://kekarehabservices.com/keka-shop/',
            description: 'Browse products',
          },
        ],
      },
      {
        id: 'home_assessment',
        question: 'How do I request a home assessment?',
        answer: 'You can request a home safety assessment by contacting our office directly. One of our occupational or physical therapists will schedule a visit to evaluate the living environment for potential hazards and risks. During the visit, we check for issues such as poor lighting, tripping hazards, unsafe stairways, or bathrooms lacking grab bars. After the assessment, we provide families with a written set of recommendations, ranging from simple rearrangements to larger modifications like ramps or railings.',
      },
      {
        id: 'fall_prevention',
        question: 'Do you help with fall prevention?',
        answer: 'Yes. Fall prevention is a central part of our care model. Our therapists develop individualized programs that combine strength and balance training, patient education, and environmental adjustments to reduce risks. We also provide practical home modification suggestions such as adding grab bars, securing rugs, adjusting furniture, or improving lighting in key areas. These recommendations are informed by decades of experience working with seniors who want to remain independent in their homes.',
      },
    ],
  },
  business: {
    id: 'business',
    emoji: '💼',
    label: 'Business & Agency Support',
    questions: [
      {
        id: 'chap_accreditation',
        question: 'Do you help with CHAP accreditation?',
        answer: 'Yes. We provide consulting support for agencies pursuing Community Health Accreditation Partner (CHAP) accreditation, a highly regarded standard in home care. Our team helps agencies prepare policies, procedures, and staff training materials that align with CHAP requirements. We also conduct readiness assessments and guide agencies through the audit process.',
        links: [
          {
            title: 'Contact Us',
            url: 'https://kekarehabservices.com/contact-us/',
            description: 'Discuss consulting needs',
          },
        ],
      },
      {
        id: 'consulting_services',
        question: 'What consulting services do you offer?',
        answer: 'We offer a wide range of consulting services for both new and established agencies. For those just starting out, we assist with regulatory compliance, workflow design, staffing models, and service offerings so agencies can launch on a solid foundation. For agencies seeking to grow, we provide strategies for scaling operations, streamlining processes, managing costs, and improving staff retention.',
      },
      {
        id: 'agency_staffing',
        question: 'Can you help staff our agency?',
        answer: 'Yes. Staffing is one of our core strengths. We maintain a network of licensed therapists, nurses, and caregivers who are available for placement. We carefully match staff with agencies based on skills, certifications, and patient populations, ensuring a good fit for both the agency and its clients. Whether you need short-term coverage or long-term placements, our staffing solutions are flexible and reliable.',
      },
      {
        id: 'staffing_difference',
        question: 'What makes your staffing different?',
        answer: 'Our staffing solutions are relationship-driven and highly personalized, not transactional. We take the time to understand each agency\'s culture, patient needs, and workflow before placing staff. This means we don\'t simply fill slots — we build partnerships. Our professionals are vetted for not only their technical skills but also their ability to provide compassionate, patient-focused care.',
      },
    ],
  },
  insurance: {
    id: 'insurance',
    emoji: '💻',
    label: 'Access, Insurance & Billing',
    questions: [
      {
        id: 'insurance_plans',
        question: 'What insurance plans do you accept?',
        answer: 'Coverage depends on your specific insurance plan, but we work with a wide range of health insurance providers and programs. When you contact us, our administrative team will verify eligibility and provide a clear explanation of what services are covered and what out-of-pocket costs may apply. We believe in transparency, so patients and families always know what to expect before care begins. Our team also helps coordinate with insurance companies so families spend less time worrying about paperwork and more time focusing on care.',
      },
      {
        id: 'insurance_paperwork',
        question: 'Can you help with insurance claims?',
        answer: 'Yes. Our administrative staff regularly assist patients and families with insurance paperwork, claims submission, and follow-up. We ensure forms are filled out accurately, supporting documentation is provided, and claims are submitted on time. If a claim is delayed or denied, we work with the insurer to resolve the issue quickly. Families often find insurance processes overwhelming, and our support helps reduce stress while ensuring access to covered services.',
      },
      {
        id: 'telehealth',
        question: 'Do you offer telehealth visits?',
        answer: 'Yes. We provide telehealth consultations for certain therapy and wellness services. These secure virtual visits allow patients to connect with licensed therapists from home, which is especially valuable for those with mobility limitations or transportation challenges. Telehealth is often used for follow-up sessions, progress monitoring, and caregiver education. Each session is delivered with the same professionalism as in-person visits and follows privacy regulations to protect patient information.',
      },
      {
        id: 'after_hours',
        question: 'How do you handle after-hours requests?',
        answer: 'Our office hours are Monday through Friday, 9:00 AM – 5:00 PM, but we understand urgent needs can arise outside these hours. Families can leave urgent messages, and our staff ensure that they are routed to the appropriate team member as quickly as possible. For true emergencies, we instruct families to call 911 immediately. Our after-hours approach balances immediate response for urgent needs with safe escalation to emergency services when required.',
      },
    ],
  },
  community: {
    id: 'community',
    emoji: '🌍',
    label: 'Community & E-Commerce',
    questions: [
      {
        id: 'online_store',
        question: 'Do you sell products online?',
        answer: 'Yes. Through our online Marketplace, we offer a selection of products including pain relief creams, mobility aids, and branded Keka merchandise. These products are carefully chosen to complement our therapy and wellness services, giving patients and families convenient access to items that support their care and daily living needs. By offering products directly, we ensure that families receive reliable and effective solutions from a trusted provider.',
        links: [
          {
            title: 'Visit Marketplace',
            url: 'https://kekarehabservices.com/keka-shop/',
            description: 'Shop online',
          },
        ],
      },
      {
        id: 'ordering_products',
        question: 'How do I order from your store?',
        answer: 'Ordering from our online store is simple. Visit the Marketplace page on our website, browse the available products, and add them to your cart. The checkout process is secure, and items are shipped directly to your home. If you have questions about which product is right for you, our staff can provide guidance before you order. This makes shopping with us not only convenient but also informed by professional expertise.',
      },
      {
        id: 'community_partners',
        question: 'Who are your Boston area partners?',
        answer: 'We are proud to be part of the Boston community and collaborate with a variety of local organizations, adult day health programs, and senior services providers. Some of our partners include: Rogerson Communities, Greater Boston Chinese Golden Age Center, Africano Waltham, and Ugandans in Massachusetts Community Health Initiative. These partnerships allow us to extend resources, share knowledge, and deliver wellness programs beyond our clinic.',
      },
      {
        id: 'outreach_programs',
        question: 'Do you provide community outreach?',
        answer: 'Yes. Community outreach is an important part of our mission. We regularly participate in health fairs, workshops, and educational programs that promote healthy aging, fall prevention, and caregiver support. These events allow us to provide practical information and tools that families can use at home. They also strengthen our connection to the community and reinforce our role as a trusted partner in wellness and rehabilitation.',
      },
    ],
  },
  client_experience: {
    id: 'client_experience',
    emoji: '🤝',
    label: 'Client Experience & Feedback',
    questions: [
      {
        id: 'first_visit',
        question: 'What should I expect at my first visit?',
        answer: 'During your first visit, a licensed therapist or caregiver will conduct a comprehensive assessment of your health, needs, and goals. This may include reviewing medical history, evaluating mobility, or discussing daily living challenges. From there, we create a personalized care or therapy plan and explain it clearly to you and your family. We encourage questions so everyone understands the approach and feels comfortable. This first visit is as much about listening as it is about assessing, ensuring that care is collaborative and aligned with the patient\'s expectations.',
      },
      {
        id: 'care_updates',
        question: 'How can I get care plan updates?',
        answer: 'We provide regular updates so families remain fully informed about their loved one\'s care. Updates may be given in person, over the phone, or by email, depending on family preference. Therapists and caregivers document progress, milestones, and any changes in the plan, and these are communicated to families promptly. By keeping families in the loop, we ensure care remains transparent, collaborative, and responsive to the patient\'s evolving needs.',
      },
      {
        id: 'feedback',
        question: 'How do I provide feedback?',
        answer: 'We welcome feedback and see it as essential to continuous improvement. Families can provide input directly to caregivers or therapists, call our office, or use the contact form on our website. All feedback is reviewed by our leadership team, and we take action where needed to improve services. By encouraging open communication, we demonstrate our commitment to transparency and partnership with families.',
      },
      {
        id: 'testimonials',
        question: 'Can I see client testimonials?',
        answer: 'Yes. Testimonials and reviews from our clients are available on our website and in our promotional materials. These stories highlight real experiences from families who have trusted us with their care, and they reflect the quality, compassion, and professionalism that define our services. We are proud to share these voices as a way to build trust with new patients and families.',
      },
      {
        id: 'what_sets_apart',
        question: 'What sets Keka apart?',
        answer: 'Keka Rehab Services is distinguished by our mission, individualized care plans, and deep community partnerships. We provide outcome-focused care that puts patients at the center of every decision. Unlike providers who deliver one-size-fits-all solutions, we tailor every plan to the unique needs of each individual. Our combination of licensed expertise, compassionate support, and community involvement makes us more than a care provider — we are a trusted partner in wellness. Families choose us because they see measurable improvements in quality of life.',
      },
    ],
  },
};

// Get category questions as buttons
export function getCategoryButtons(categoryId: string): Button[] {
  const category = FAQ_CATEGORIES[categoryId];
  if (!category) return [];

  return category.questions.map(q => ({
    label: q.question,
    value: q.id,
  }));
}

// Get FAQ answer by question ID
export function getFAQAnswer(categoryId: string, questionId: string): FAQQuestion | null {
  const category = FAQ_CATEGORIES[categoryId];
  if (!category) return null;

  return category.questions.find(q => q.id === questionId) || null;
}

// Generate home screen response
export function getHomeScreen(): BotResponse {
  return {
    text: 'Welcome to Keka Rehab Services. How can we help you today?',
    buttons: TOP_LEVEL_MENU,
    next_state: 'awaiting_user_choice',
    session_data: {
      state: 'awaiting_user_choice',
    },
  };
}

// Generate resolution check buttons
export function getResolutionButtons(): Button[] {
  return [
    { label: 'This answered my question', value: 'resolved' },
    { label: 'I need more help', value: 'contact_me' },
  ];
}
