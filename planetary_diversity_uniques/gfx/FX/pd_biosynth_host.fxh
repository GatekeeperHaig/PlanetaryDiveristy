// Shared Biosynthetic host recolor, included by both the plain and the council portrait shaders.
// Strips color but keeps the light-to-dark range, lifts to a pale off-white body, then recolors the strongly saturated painted accents to one emissive green.
float3 PdBiosynthHost( float3 vSource )
{
	const float vDesaturation = 0.6; // 0 keeps hue, 1 is full grayscale
	const float vBrighten = 0.6; // below 1 lifts midtones but leaves the black and white ends in place, so contrast survives
	const float3 vTint = float3( 1.0, 0.98, 0.95 );
	float vLum = dot( vSource, float3( 0.2126, 0.7152, 0.0722 ) );
	float3 vBody = lerp( vSource, float3( vLum, vLum, vLum ), vDesaturation );
	vBody = pow( saturate( vBody ), vBrighten ) * vTint;

	const float vAccentThreshold = 0.6; // saturation under this reads as body, which ignores ambient color cast; over it glows
	const float vAccentSharpness = 4.0; // how fast a pixel counts as an accent past the threshold
	const float vBrightGate = 2.0; // how bright an accent must also be, so dark tinted shadows do not glow
	const float3 vGlowColor = float3( 0.20, 1.0, 0.35 );
	const float vGlowBoost = 1.4;
	float vMax = max( vSource.r, max( vSource.g, vSource.b ) );
	float vMin = min( vSource.r, min( vSource.g, vSource.b ) );
	float vSaturation = ( vMax - vMin ) / max( vMax, 0.001 );
	float vAccentMask = saturate( ( vSaturation - vAccentThreshold ) * vAccentSharpness );
	vAccentMask *= saturate( vMax * vBrightGate );
	float3 vGlow = vGlowColor * saturate( vMax * vGlowBoost );

	return lerp( vBody, vGlow, vAccentMask );
}
