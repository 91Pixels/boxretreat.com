import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const rentalId = formData.get('rentalId') as string;
    const files = formData.getAll('photos') as File[];

    if (!rentalId || files.length === 0) {
      return NextResponse.json({ error: 'Missing rentalId or photos' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('id, status, rental_id')
      .eq('rental_id', rentalId)
      .single();

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    if (rental.status === 'returned' || rental.status === 'completed') {
      return NextResponse.json({ error: 'Return already submitted' }, { status: 409 });
    }

    const photoUrls: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${rentalId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('gear-return-photos')
        .upload(path, buffer, { contentType: file.type, upsert: false });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 });
      }

      const { data: urlData } = supabase.storage
        .from('gear-return-photos')
        .getPublicUrl(path);

      photoUrls.push(urlData.publicUrl);
    }

    const { error: updateError } = await supabase
      .from('gear_rentals')
      .update({
        status: 'returned',
        return_photo_urls: photoUrls,
        return_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('rental_id', rentalId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Could not update rental' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('Gear return error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Return submission failed' },
      { status: 500 }
    );
  }
}
