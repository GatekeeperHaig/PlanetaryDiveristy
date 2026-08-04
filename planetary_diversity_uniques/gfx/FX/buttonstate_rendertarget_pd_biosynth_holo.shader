Includes = {
	"buttonstate.fxh"
}

PixelShader =
{
	Samplers =
	{
		MapTexture =
		{
			Index = 0
			MagFilter = "linear"
			MinFilter = "linear"
			MipFilter = "None"
			AddressU = "Clamp"
			AddressV = "Clamp"
		}

		MaskingTexture =
		{
			Index = 5
			MagFilter = "Point"
			MinFilter = "Point"
			MipFilter = "None"
			AddressU = "Clamp"
			AddressV = "Clamp"
		}
	}
}


VertexStruct VS_OUTPUT
{
	float4  vPosition : PDX_POSITION;
	float2  vScreenPos : TEXCOORD3;
	float2  vTexCoord : TEXCOORD0;
@ifdef MASKING
	float2  vMaskingTexCoord : TEXCOORD2;
@endif
};


VertexShader =
{
	MainCode VertexShader
		ConstantBuffers = { Common }
	[[
		VS_OUTPUT main(const VS_INPUT v )
		{
			VS_OUTPUT Out;
			Out.vPosition  = mul( WorldViewProjectionMatrix, float4( v.vPosition.xyz, 1 ) );
			Out.vScreenPos = Out.vPosition.xy;

			Out.vTexCoord = v.vTexCoord;
			Out.vTexCoord += Offset;

		#ifdef MASKING
			//A bit hacky, but we want the masking texture coordinates to be in the range [0,1]. We turn all 0's to 0 and all nonzero to 1.
			Out.vMaskingTexCoord = saturate(v.vTexCoord * 1000);
		#endif

#ifdef PDX_OPENGL
			//Flip texture coordinates so map is not upside down
			Out.vTexCoord.y = 1 - Out.vTexCoord.y;
#endif

			return Out;
		}
	]]
}

PixelShader =
{
	MainCode PixelShader
		ConstantBuffers = { Common }
	[[
		float4 main( VS_OUTPUT v ) : PDX_COLOR
		{
			// Projection static, strongest near the bottom, drives a slight horizontal waver.
			const float vFadeoutHeight = 5;
			const float vFadeoutPosition = 0.95;
			const float vMinimumStatic = 0.03;
			float vAmountStatic = saturate(v.vTexCoord.y - vFadeoutPosition) * vFadeoutHeight + vMinimumStatic;

			const float vNumberOfScanlines = 4;
			const float vScanlineSpeed = 0.2;
			float vGradientScanline = 1 - mod(((v.vTexCoord.y) * vNumberOfScanlines + Time * vScanlineSpeed), 1);

			float2 texCoord = v.vTexCoord;
			texCoord.x += (vGradientScanline - 0.5) * vAmountStatic * 0.2;
			float4 TextureColor = tex2D( MapTexture, texCoord );

			float4 OutColor = tex2D( MapTexture, v.vTexCoord );

			// Living-metal host body, kept in sync with buttonstate_rendertarget_pd_biosynth.shader.
			const float vDesaturation = 1.0;
			const float vBrighten = 0.5;
			const float3 vTint = float3( 0.97, 0.98, 1.0 );
			float vLum = dot( OutColor.rgb, float3( 0.2126, 0.7152, 0.0722 ) );
			float3 vBody = lerp( OutColor.rgb, float3( vLum, vLum, vLum ), vDesaturation );
			vBody = pow( saturate( vBody ), vBrighten ) * vTint;

			// Living-metal ripple (silver), gated to the dark interior, same as the plain shader.
			const float vRippleScale = 16.0;
			const float vRippleSpeed = 0.6;
			const float vRippleBoost = 0.35;
			const float3 vRippleColor = float3( 0.85, 0.92, 1.0 );
			float2 vRippleUV = v.vTexCoord;
			vRippleUV.x += sin( v.vTexCoord.y * 6.0 - Time * 0.5 ) * 0.12;
			vRippleUV.y += sin( v.vTexCoord.x * 5.0 + Time * 0.4 ) * 0.12;
			float vWaveA = sin( ( vRippleUV.x + vRippleUV.y * 1.3 ) * vRippleScale + Time * vRippleSpeed );
			float vWaveB = sin( ( vRippleUV.x * 1.7 - vRippleUV.y ) * vRippleScale * 0.6 - Time * vRippleSpeed * 0.8 );
			float vWaveC = sin( ( vRippleUV.x * 0.6 + vRippleUV.y * 2.1 ) * vRippleScale * 0.4 + Time * vRippleSpeed * 1.3 );
			float vRipple = ( vWaveA + vWaveB + vWaveC ) * 0.33;
			float vInterior = pow( saturate( 1.0 - vLum ), 2.0 );
			vBody += saturate(  vRipple ) * vRippleBoost * 0.35 * vInterior * vRippleColor;
			vBody -= saturate( -vRipple ) * vRippleBoost * vInterior * 0.6;

			// Hologram projection on top of the host: edge detection in blue, keeping the projection look.
			const float vEdgeThickness = 0.008;
			const float vEdgeBoost = 2;
			const float vEdgeContrast = 1;
			float4 SampleH = tex2D( MapTexture, texCoord + float2(vEdgeThickness, 0));
			float4 SampleV = tex2D( MapTexture, texCoord + float2(0, vEdgeThickness));
			float4 SampleHDiff = abs(TextureColor - SampleH);
			float4 SampleVDiff = abs(TextureColor - SampleV);
			float4 EdgeAmount = max(SampleHDiff, SampleVDiff);
			float vEdgeAmount = max(EdgeAmount.r, max(EdgeAmount.g, max(EdgeAmount.b, EdgeAmount.a)));
			vEdgeAmount = pow(vEdgeAmount * vEdgeBoost, vEdgeContrast);
			const float3 vEdgeColor = float3( 0.4, 0.7, 1.0 );
			float3 EdgesOverlay = saturate(vEdgeAmount * vEdgeColor);

			// Blue projection fill, the holographic tint over the body.
			float maxChannel = max(TextureColor.r, max(TextureColor.g, TextureColor.b));
			const float3 ShadowColor = float3( 0.02, 0.06, 0.14 );
			const float3 HighlightColor = float3( 0.06, 0.14, 0.28 );
			float3 Fill = lerp( ShadowColor, HighlightColor, maxChannel );

			OutColor.rgb = vBody + Fill + EdgesOverlay * 0.4;

		#ifdef MASKING
			float4 MaskColor = tex2D( MaskingTexture, v.vMaskingTexCoord );
			OutColor.a *= MaskColor.a;
		#endif

			OutColor *= Color;
			return OutColor;
		}
	]]

}


BlendState BlendState
{
	BlendEnable = yes
	SourceBlend = "src_alpha"
	DestBlend = "inv_src_alpha"
}


Effect Up
{
	VertexShader = "VertexShader"
	PixelShader = "PixelShader"
}

Effect Down
{
	VertexShader = "VertexShader"
	PixelShader = "PixelShader"
}

Effect Disable
{
	VertexShader = "VertexShader"
	PixelShader = "PixelShader"
}

Effect Over
{
	VertexShader = "VertexShader"
	PixelShader = "PixelShader"
}
