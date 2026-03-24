import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ChordVoicing {
  chordName: string;
  frets: (number | "x")[]; // e.g., [x, 3, 2, 0, 1, 0]
  fingers?: (number | null)[];
  barre?: number;
}

export interface VoicingSet {
  name: string;
  description: string;
  voicings: ChordVoicing[];
}

export async function generateVoicings(key: string, progression: string): Promise<VoicingSet[]> {
  const isMathRock = progression.toLowerCase().includes('math rock');
  const prompt = `Generate 4 distinct sets of guitar voicings for the chord progression "${progression}" in the key of "${key}". 
  Each set should have a descriptive name (e.g., "Classic Open", "Power Barre", "Jazz Shells", "Triads", "Math Rock Tapping", "Twinkle Extensions") and a brief description.
  ${isMathRock ? 'Since this is a Math Rock progression, please include at least one set with complex extensions (9ths, 11ths, 13ths) or unusual open-string voicings typical of the genre.' : ''}
  For each chord in the progression, provide the fret positions as an array of 6 elements (E, A, D, G, B, e strings). 
  Use numbers for frets and "x" for muted strings.
  
  Example format for C Major: ["x", 3, 2, 0, 1, 0]
  
  Return the data as a JSON array of objects with the following structure:
  {
    "name": string,
    "description": string,
    "voicings": [
      { "chordName": string, "frets": (number | "x")[] }
    ]
  }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              voicings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    chordName: { type: Type.STRING },
                    frets: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING } // Using string to handle "x" and numbers
                    }
                  },
                  required: ["chordName", "frets"]
                }
              }
            },
            required: ["name", "description", "voicings"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    const parsed = JSON.parse(text);
    // Convert fret strings back to numbers where possible
    return parsed.map((set: any) => ({
      ...set,
      voicings: set.voicings.map((v: any) => ({
        ...v,
        frets: v.frets.map((f: any) => (f === "x" || f === "X" ? "x" : parseInt(f, 10)))
      }))
    }));
  } catch (error) {
    console.error("Error generating voicings:", error);
    return [];
  }
}
