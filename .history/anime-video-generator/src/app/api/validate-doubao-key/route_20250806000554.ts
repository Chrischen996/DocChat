import { NextRequest, NextResponse } from 'next/server';
import { DoubaoClient } from '@/lib/doubao-client';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    // Use real Doubao client for validation
    const client = new DoubaoClient(apiKey);
    
    try {
      const isValid = await client.validateApiKey();
      
      if (isValid) {
        return NextResponse.json({ 
          valid: true, 
          message: 'Doubao API key is valid' 
        });
      } else {
        return NextResponse.json(
          { valid: false, error: 'Invalid Doubao API key' },
          { status: 401 }
        );
      }

    } catch (error: any) {
      console.error('Doubao API key validation error:', error);
      
      if (error.message?.includes('401') || 
          error.message?.includes('unauthorized') ||
          error.message?.includes('authentication')) {
        return NextResponse.json(
          { valid: false, error: 'Invalid Doubao API key' },
          { status: 401 }
        );
      }
      
      // For other errors, assume the key might be invalid
      return NextResponse.json(
        { valid: false, error: 'Failed to validate Doubao API key. Please check your key.' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Doubao API key validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate Doubao API key' },
      { status: 500 }
    );
  }
}
