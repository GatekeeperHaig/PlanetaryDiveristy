Includes = {
	"constants.fxh"
	"buttonstate.fxh"
	"utils.fxh"
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
			float4 OutColor = tex2D( MapTexture, v.vTexCoord );

			// Synthetic host body: desaturate but keep contrast, lift to a pale off-white material.
			// vDesaturation: 0 = keep hue, 1 = full grayscale.
			// vBrighten: < 1 lifts midtones while leaving black/white ends in place (keeps contrast).
			// vTint: subtle off-white color of the synthetic skin.
			const float vDesaturation = 1.0;
			const float vBrighten = 0.5;
			const float3 vTint = float3( 0.97, 0.98, 1.0 );
			float vLum = dot( OutColor.rgb, float3( 0.2126, 0.7152, 0.0722 ) );
			float3 vBody = lerp( OutColor.rgb, float3( vLum, vLum, vLum ), vDesaturation );
			OutColor.rgb = pow( saturate( vBody ), vBrighten ) * vTint;

			// Idea 1 - Crevice glow: the body's dark recesses and seams glow green, lit surfaces stay matte,
			// so energy reads as shining through the gaps of the living metal. Keyed to shadow, not painted color.
			// vCreviceColor: glow color. vCreviceDepth: how dark a pixel must be to glow (higher = only deepest).
			// vCreviceBoost: glow intensity.
			const float3 vCreviceColor = float3( 0.20, 1.0, 0.35 );
			const float vCreviceDepth = 10.0;
			const float vCreviceBoost = 0.0;
			float vCrevice = saturate( 1.0 - vLum * vCreviceDepth );
			OutColor.rgb += vCreviceColor * vCrevice * vCreviceBoost;

			// Idea 2 - Living-metal ripple: coordinates warped by a slow wave (domain warp) so the light wanders
			// organically like energy under the skin, three off-frequency waves break up the repetition. Gated to
			// the dark interior so it reads as internal, bright silver crests with darker troughs for churn.
			// vRippleScale: density. vRippleSpeed: flow speed. vRippleBoost: strength. vRippleColor: silver light.
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
			OutColor.rgb += saturate(  vRipple ) * vRippleBoost * 0.35 * vInterior * vRippleColor;
			OutColor.rgb -= saturate( -vRipple ) * vRippleBoost * vInterior * 0.6;

		#ifdef MASKING
			float4 MaskColor = tex2D( MaskingTexture, v.vMaskingTexCoord );
			OutColor.a *= MaskColor.a;
		#endif

			OutColor *= Color;
			return OutColor;
		}
	]]

	MainCode PixelShaderDisable
		ConstantBuffers = { Common }
	[[
		float4 main( VS_OUTPUT v ) : PDX_COLOR
		{
			float4 OutColor = tex2D( MapTexture, v.vTexCoord );
			OutColor.rgb = GreyOutLuminosity( OutColor.rgb, GREY_OUT_GREYNESS, GREY_OUT_BRIGHTNESS );

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
	PixelShader = "PixelShaderDisable"
}

Effect Over
{
	VertexShader = "VertexShader"
	PixelShader = "PixelShader"
}
