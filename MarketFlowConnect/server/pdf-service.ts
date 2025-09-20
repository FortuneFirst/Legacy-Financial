import { jsPDF } from "jspdf";

export interface PDFGenerationOptions {
  title: string;
  content: string[];
  footer?: string;
  headerColor?: string;
}

export class PDFService {
  static generateInsuranceGuide(): Buffer {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(0, 102, 204); // Blue
    doc.rect(0, 0, 210, 48, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Fortune First', 20, 25);
    
    doc.setFontSize(16);
    doc.text('Top 5 Life Insurance Strategies', 20, 35);
    doc.text('for High-Income Earners', 20, 42);
    
    // Reset text color for body
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    let yPos = 60;
    
    // Introduction
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Maximize Your Wealth Protection & Growth', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const intro = 'As a high-income earner, you need sophisticated strategies that not only protect your family but also build long-term wealth. Here are the top 5 strategies we recommend:';
    const introLines = doc.splitTextToSize(intro, 170);
    doc.text(introLines, 20, yPos);
    yPos += introLines.length * 5 + 10;
    
    // Strategy 1
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Indexed Universal Life (IUL) Insurance', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const strategy1 = 'Build tax-free wealth with market upside potential and downside protection. Perfect for high earners looking to supplement retirement income while providing life insurance protection.';
    const strategy1Lines = doc.splitTextToSize(strategy1, 170);
    doc.text(strategy1Lines, 25, yPos);
    yPos += strategy1Lines.length * 5 + 8;
    
    // Strategy 2
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Whole Life Insurance with Paid-Up Additions', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const strategy2 = 'Create a tax-advantaged savings vehicle with guaranteed growth and dividend potential. Ideal for conservative wealth building and estate planning.';
    const strategy2Lines = doc.splitTextToSize(strategy2, 170);
    doc.text(strategy2Lines, 25, yPos);
    yPos += strategy2Lines.length * 5 + 8;
    
    // Strategy 3
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Variable Universal Life (VUL) for Investment Control', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const strategy3 = 'Take control of your investment options within your life insurance policy. Best for sophisticated investors who want to direct their cash value growth.';
    const strategy3Lines = doc.splitTextToSize(strategy3, 170);
    doc.text(strategy3Lines, 25, yPos);
    yPos += strategy3Lines.length * 5 + 8;
    
    // Strategy 4
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Modified Endowment Contract (MEC) Strategy', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const strategy4 = 'Maximize cash value growth for those who want to fund policies quickly. Provides tax-deferred growth similar to an annuity with life insurance benefits.';
    const strategy4Lines = doc.splitTextToSize(strategy4, 170);
    doc.text(strategy4Lines, 25, yPos);
    yPos += strategy4Lines.length * 5 + 8;
    
    // Strategy 5
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Life Insurance Retirement Plan (LIRP)', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const strategy5 = 'Create tax-free retirement income streams using life insurance cash values. Supplement 401(k) and IRA withdrawals with tax-free policy loans.';
    const strategy5Lines = doc.splitTextToSize(strategy5, 170);
    doc.text(strategy5Lines, 25, yPos);
    yPos += strategy5Lines.length * 5 + 15;
    
    // Call to action
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos, 180, 30, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Ready to Implement These Strategies?', 20, yPos + 10);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Contact Fortune First today for a personalized consultation.', 20, yPos + 18);
    doc.text('Call: (555) 123-4567 | Email: info@fortunefirst.net', 20, yPos + 25);
    
    return Buffer.from(doc.output('arraybuffer'));
  }
  
  static generateRetirementChecklist(): Buffer {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(34, 139, 34); // Green
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Fortune First', 20, 25);
    
    doc.setFontSize(16);
    doc.text('Retirement Security Checklist', 20, 35);
    
    // Reset text color for body
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    let yPos = 60;
    
    // Introduction
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Assess Your Retirement Readiness', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const intro = 'Use this comprehensive checklist to evaluate your retirement security and identify areas for improvement:';
    const introLines = doc.splitTextToSize(intro, 170);
    doc.text(introLines, 20, yPos);
    yPos += introLines.length * 5 + 15;
    
    const checklistItems = [
      'I have calculated my retirement income needs (aim for 70-80% of current income)',
      'I am maximizing employer 401(k) matching contributions',
      'I am contributing to additional retirement accounts (IRA, Roth IRA)',
      'I have a diversified investment portfolio appropriate for my age',
      'I have adequate life insurance coverage (10x annual income minimum)',
      'I have long-term care insurance or a plan for care costs',
      'I have an emergency fund covering 6-12 months of expenses',
      'I have minimized high-interest debt (credit cards, etc.)',
      'I have a comprehensive estate plan with updated beneficiaries',
      'I regularly review and rebalance my investment portfolio',
      'I have considered tax-efficient retirement withdrawal strategies',
      'I have planned for healthcare costs in retirement',
      'I have considered Social Security optimization strategies',
      'I have a backup plan if I cannot work until planned retirement age'
    ];
    
    checklistItems.forEach((item, index) => {
      // Checkbox
      doc.rect(20, yPos - 3, 4, 4, 'D');
      
      // Item text
      doc.setFontSize(10);
      const itemLines = doc.splitTextToSize(item, 160);
      doc.text(itemLines, 30, yPos);
      yPos += Math.max(itemLines.length * 4, 6) + 3;
      
      // Add page break if needed
      if (yPos > 260) {
        doc.addPage();
        yPos = 30;
      }
    });
    
    yPos += 10;
    
    // Scoring section
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos, 180, 45, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Your Retirement Security Score', 20, yPos + 10);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Count your checked items:', 20, yPos + 18);
    doc.text('12-14 items: Excellent retirement readiness', 20, yPos + 25);
    doc.text('8-11 items: Good foundation, some areas to improve', 20, yPos + 32);
    doc.text('4-7 items: Need significant planning attention', 20, yPos + 39);
    doc.text('0-3 items: Urgent retirement planning required', 20, yPos + 46);
    
    yPos += 55;
    
    // Call to action
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Need Help Improving Your Score?', 20, yPos);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Schedule a free consultation with our retirement planning experts.', 20, yPos + 8);
    doc.text('Call: (555) 123-4567 | Email: retirement@fortunefirst.net', 20, yPos + 15);
    
    return Buffer.from(doc.output('arraybuffer'));
  }
  
  static generateDistributorKit(): Buffer {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(255, 140, 0); // Orange
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Fortune First', 20, 25);
    
    doc.setFontSize(16);
    doc.text('Distributor Success Starter Kit', 20, 35);
    
    // Reset text color for body
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    let yPos = 60;
    
    // Introduction
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Turn Protection Into Prosperity', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const intro = 'Welcome to Fortune First! This starter kit will guide you through building a successful business helping families secure their financial future.';
    const introLines = doc.splitTextToSize(intro, 170);
    doc.text(introLines, 20, yPos);
    yPos += introLines.length * 5 + 15;
    
    // Section 1: Income Potential
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Unlimited Income Potential', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const income = 'As a Fortune First distributor, your income is directly tied to your effort and results. Top performers earn six-figure incomes helping families protect what matters most.';
    const incomeLines = doc.splitTextToSize(income, 170);
    doc.text(incomeLines, 20, yPos);
    yPos += incomeLines.length * 5 + 10;
    
    // Section 2: Training & Support
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Comprehensive Training Program', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const training = 'Our proven training system includes online courses, live workshops, mentorship programs, and ongoing support. No prior experience required.';
    const trainingLines = doc.splitTextToSize(training, 170);
    doc.text(trainingLines, 20, yPos);
    yPos += trainingLines.length * 5 + 10;
    
    // Section 3: Getting Started
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Your First 30 Days', 20, yPos);
    yPos += 8;
    
    const steps = [
      'Complete online certification training (2-3 hours)',
      'Attend virtual new distributor orientation',
      'Meet your assigned mentor and development team',
      'Complete your first practice presentations',
      'Begin working with warm market contacts',
      'Attend weekly team training calls',
      'Set your 90-day income goals'
    ];
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    steps.forEach((step, index) => {
      doc.text(`${index + 1}. ${step}`, 25, yPos);
      yPos += 6;
    });
    
    yPos += 10;
    
    // Section 4: Support & Resources
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Resources Available to You', 20, yPos);
    yPos += 8;
    
    const resources = [
      'Marketing materials and presentation tools',
      'Lead generation systems and training',
      'Product knowledge and sales training',
      '24/7 online learning platform access',
      'Regional and national conferences',
      'Recognition and advancement opportunities'
    ];
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    resources.forEach((resource) => {
      doc.text(`• ${resource}`, 25, yPos);
      yPos += 6;
    });
    
    yPos += 15;
    
    // Call to action
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos, 180, 30, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Ready to Get Started?', 20, yPos + 10);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Contact your recruiter or call our opportunity hotline today!', 20, yPos + 18);
    doc.text('Call: (555) 123-4567 | Email: opportunity@fortunefirst.net', 20, yPos + 25);
    
    return Buffer.from(doc.output('arraybuffer'));
  }
}