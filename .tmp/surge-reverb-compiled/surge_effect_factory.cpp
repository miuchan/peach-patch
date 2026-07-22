// Browser-specialized form of Surge XT Effect.cpp.
#include "Effect.h"
#include "Reverb1Effect.h"

Effect *spawn_effect(int, SurgeStorage *storage, FxStorage *fxdata, pdata *pd) { return new Reverb1Effect(storage, fxdata, pd); }

Effect::Effect(SurgeStorage *storage, FxStorage *fxdata, pdata *pd)
{
    // assert(storage);
    this->fxdata = fxdata;
    this->storage = storage;
    this->pd = pd;
    ringout = 10000000;
    if (pd)
    {
        for (int i = 0; i < n_fx_params; i++)
        {
            pd_float[i] = &pd[fxdata->p[i].id].f;
            pd_int[i] = &pd[fxdata->p[i].id].i;
        }
    }
}

bool Effect::process_ringout(float *dataL, float *dataR, bool indata_present)
{
    if (indata_present)
        ringout = 0;
    else
        ringout++;

    int d = get_ringout_decay();
    if ((d < 0) || (ringout < d) || (ringout == 0))
    {
        process(dataL, dataR);
        return true;
    }
    else
        process_only_control();
    return false;
}

void Effect::init_ctrltypes()
{
    for (int j = 0; j < n_fx_params; j++)
    {
        fxdata->p[j].modulateable = true;
        fxdata->p[j].set_type(ct_none);
    }
}
