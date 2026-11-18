import { Settings } from '@shared/types';
import * as fs from 'fs';
import * as path from 'path';

export class ContextManager {
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  updateSettings(settings: Settings) {
    this.settings = settings;
  }

  // Build context prompt for AI
  buildContext(question: string, additionalContext?: string): string {
    const parts: string[] = [];

    // System instruction
    parts.push(`You are an expert interview assistant. The user is currently in a live interview.
The interviewer just asked: "${question}"

Provide a concise, helpful response that the candidate can use.`);

    // Resume context
    if (this.settings.resumeText) {
      parts.push(`CANDIDATE BACKGROUND (from resume):
${this.truncate(this.settings.resumeText, 3000)}`);
    }

    // Job description context
    if (this.settings.jobDescription) {
      parts.push(`JOB DESCRIPTION:
${this.truncate(this.settings.jobDescription, 2000)}`);
    }

    // Company context
    if (this.settings.companyName) {
      parts.push(`COMPANY: ${this.settings.companyName}`);
    }

    // Additional context from user
    if (additionalContext) {
      parts.push(`ADDITIONAL CONTEXT:
${additionalContext}`);
    }

    // Response guidelines
    parts.push(`RESPONSE GUIDELINES:
- Keep response under 150 words
- Use bullet points for key points
- Include specific examples from experience when relevant
- Be confident but honest
- If technical question, provide code/approach outline
- If behavioral, use STAR method (Situation, Task, Action, Result)`);

    return parts.join('\n\n');
  }

  // Parse resume from file
  async parseResume(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    try {
      switch (ext) {
        case '.pdf':
          return await this.parsePDF(filePath);
        case '.docx':
          return await this.parseDOCX(filePath);
        case '.txt':
        case '.md':
          return fs.readFileSync(filePath, 'utf-8');
        default:
          // Try as text
          return fs.readFileSync(filePath, 'utf-8');
      }
    } catch (error: unknown) {
      console.error('Resume parsing error:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse resume: ${message}`);
    }
  }

  // Parse job description from file
  async parseJobDescription(filePath: string): Promise<string> {
    return this.parseResume(filePath); // Same logic
  }

  private async parsePDF(filePath: string): Promise<string> {
    try {
      // v1 build: works in Node without DOM globals (v2 needs DOMMatrix).
      const pdfParse: (data: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      console.warn('pdf-parse failed, trying alternative:', error);
      return this.extractTextFromPDF(filePath);
    }
  }

  private async extractTextFromPDF(filePath: string): Promise<string> {
    // Use pdftotext if available
    try {
      const { execSync } = require('child_process');
      const output = execSync(`pdftotext "${filePath}" -`, { encoding: 'utf-8', timeout: 10000 });
      return output;
    } catch {
      throw new Error('PDF parsing requires pdf-parse or pdftotext. Please install poppler-utils or use .txt/.docx format.');
    }
  }

  private async parseDOCX(filePath: string): Promise<string> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.warn('mammoth failed:', error);
      throw new Error('DOCX parsing requires mammoth. Please use .txt or .pdf format.');
    }
  }

  // Extract key information from resume for better context
  extractResumeHighlights(resumeText: string): {
    skills: string[];
    experience: string[];
    education: string[];
    projects: string[];
  } {
    const skills: string[] = [];
    const experience: string[] = [];
    const education: string[] = [];
    const projects: string[] = [];

    // Simple keyword extraction (in production, use NLP)
    const skillKeywords = [
      'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust',
      'react', 'vue', 'angular', 'node.js', 'express', 'django', 'flask',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform',
      'sql', 'nosql', 'mongodb', 'postgresql', 'redis',
      'git', 'ci/cd', 'jenkins', 'github actions', 'gitlab',
      'microservices', 'rest', 'graphql', 'grpc',
      'testing', 'jest', 'cypress', 'selenium',
      'agile', 'scrum', 'kanban',
    ];

    const lowerText = resumeText.toLowerCase();
    skillKeywords.forEach(skill => {
      if (lowerText.includes(skill)) {
        skills.push(skill);
      }
    });

    // Extract experience sections
    const expMatches = resumeText.match(/(?:experience|work history|employment)[\s\S]{0,500}/gi);
    if (expMatches) {
      experience.push(...expMatches.slice(0, 3));
    }

    // Extract education
    const eduMatches = resumeText.match(/(?:education|degree|university|college)[\s\S]{0,300}/gi);
    if (eduMatches) {
      education.push(...eduMatches.slice(0, 2));
    }

    // Extract projects
    const projMatches = resumeText.match(/(?:projects?|portfolio)[\s\S]{0,500}/gi);
    if (projMatches) {
      projects.push(...projMatches.slice(0, 3));
    }

    return { skills, experience, education, projects };
  }

  // Extract key requirements from job description
  extractJobRequirements(jobDescription: string): {
    requiredSkills: string[];
    preferredSkills: string[];
    responsibilities: string[];
    qualifications: string[];
  } {
    const requiredSkills: string[] = [];
    const preferredSkills: string[] = [];
    const responsibilities: string[] = [];
    const qualifications: string[] = [];

    const lowerJD = jobDescription.toLowerCase();

    // Look for required/preferred sections
    const requiredMatch = jobDescription.match(/(?:required|must have|requirements)[\s\S]{0,500}/i);
    if (requiredMatch) {
      requiredSkills.push(...this.extractSkills(requiredMatch[0]));
    }

    const preferredMatch = jobDescription.match(/(?:preferred|nice to have|bonus)[\s\S]{0,500}/i);
    if (preferredMatch) {
      preferredSkills.push(...this.extractSkills(preferredMatch[0]));
    }

    const respMatch = jobDescription.match(/(?:responsibilities|duties|will be responsible)[\s\S]{0,500}/i);
    if (respMatch) {
      responsibilities.push(respMatch[0].substring(0, 300));
    }

    const qualMatch = jobDescription.match(/(?:qualifications|requirements|skills)[\s\S]{0,500}/i);
    if (qualMatch) {
      qualifications.push(qualMatch[0].substring(0, 300));
    }

    return { requiredSkills, preferredSkills, responsibilities, qualifications };
  }

  private extractSkills(text: string): string[] {
    const skillKeywords = [
      'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust',
      'react', 'vue', 'angular', 'node.js', 'express', 'django', 'flask',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform',
      'sql', 'nosql', 'mongodb', 'postgresql', 'redis',
      'git', 'ci/cd', 'jenkins', 'github actions', 'gitlab',
      'microservices', 'rest', 'graphql', 'grpc',
      'testing', 'jest', 'cypress', 'selenium',
      'agile', 'scrum', 'kanban',
    ];

    const found: string[] = [];
    const lowerText = text.toLowerCase();

    skillKeywords.forEach(skill => {
      if (lowerText.includes(skill) && !found.includes(skill)) {
        found.push(skill);
      }
    });

    return found;
  }

  // Match resume to job description
  matchResumeToJob(resumeText: string, jobDescription: string): {
    matchScore: number;
    matchingSkills: string[];
    missingSkills: string[];
    suggestions: string[];
  } {
    const resumeSkills = this.extractResumeHighlights(resumeText).skills;
    const jobReqs = this.extractJobRequirements(jobDescription);

    const allJobSkills = [...jobReqs.requiredSkills, ...jobReqs.preferredSkills];
    const matchingSkills = resumeSkills.filter(s => allJobSkills.includes(s));
    const missingSkills = jobReqs.requiredSkills.filter(s => !resumeSkills.includes(s));

    const matchScore = allJobSkills.length > 0
      ? Math.round((matchingSkills.length / allJobSkills.length) * 100)
      : 0;

    const suggestions: string[] = [];
    if (missingSkills.length > 0) {
      suggestions.push(`Consider highlighting experience with: ${missingSkills.slice(0, 5).join(', ')}`);
    }
    if (matchingSkills.length > 0) {
      suggestions.push(`Strong matches: ${matchingSkills.slice(0, 5).join(', ')} - emphasize these`);
    }

    return { matchScore, matchingSkills, missingSkills, suggestions };
  }

  // Get context summary for UI display
  getContextSummary(): {
    hasResume: boolean;
    hasJobDescription: boolean;
    hasCompany: boolean;
    resumeLength: number;
    jobDescriptionLength: number;
  } {
    return {
      hasResume: !!this.settings.resumeText?.trim(),
      hasJobDescription: !!this.settings.jobDescription?.trim(),
      hasCompany: !!this.settings.companyName?.trim(),
      resumeLength: this.settings.resumeText?.length || 0,
      jobDescriptionLength: this.settings.jobDescription?.length || 0,
    };
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '... [truncated]';
  }

  // Clear all context
  clearContext(): void {
    // This would be called via settings manager
  }
}